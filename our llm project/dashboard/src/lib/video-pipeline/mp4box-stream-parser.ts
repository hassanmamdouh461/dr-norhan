export class MP4BoxStreamParser {
  private buffer: Uint8Array = new Uint8Array(0);
  
  onInitSegment?: (data: Uint8Array) => void;
  onSegment?: (data: Uint8Array, index: number) => void;
  
  private initBuffers: Uint8Array[] = [];
  private currentSegmentBuffers: Uint8Array[] = [];
  private segmentIndex = 0;

  append(data: Uint8Array) {
    const newBuffer = new Uint8Array(this.buffer.length + data.length);
    newBuffer.set(this.buffer);
    newBuffer.set(data, this.buffer.length);
    this.buffer = newBuffer;
    
    this.parse();
  }
  
  private parse() {
    while (true) {
      if (this.buffer.length < 8) {
        break;
      }
      
      const view = new DataView(this.buffer.buffer, this.buffer.byteOffset, this.buffer.byteLength);
      let boxSize = view.getUint32(0);
      const boxType = String.fromCharCode(
        this.buffer[4],
        this.buffer[5],
        this.buffer[6],
        this.buffer[7]
      );
      
      let headerSize = 8;
      if (boxSize === 1) {
        if (this.buffer.length < 16) {
          break;
        }
        const high = view.getUint32(8);
        const low = view.getUint32(12);
        boxSize = high * 0x100000000 + low;
        headerSize = 16;
      }
      
      if (this.buffer.length < boxSize) {
        break;
      }
      
      const boxData = this.buffer.slice(0, boxSize);
      this.buffer = this.buffer.slice(boxSize);
      
      this.handleBox(boxType, boxData);
    }
  }
  
  private handleBox(type: string, data: Uint8Array) {
    if (type === 'ftyp' || type === 'moov') {
      this.initBuffers.push(data);
      if (type === 'moov') {
        const totalLength = this.initBuffers.reduce((sum, b) => sum + b.length, 0);
        const initSegment = new Uint8Array(totalLength);
        let offset = 0;
        for (const b of this.initBuffers) {
          initSegment.set(b, offset);
          offset += b.length;
        }
        this.onInitSegment?.(initSegment);
      }
    } else if (type === 'moof' || type === 'mdat') {
      this.currentSegmentBuffers.push(data);
      if (type === 'mdat') {
        const totalLength = this.currentSegmentBuffers.reduce((sum, b) => sum + b.length, 0);
        const mediaSegment = new Uint8Array(totalLength);
        let offset = 0;
        for (const b of this.currentSegmentBuffers) {
          mediaSegment.set(b, offset);
          offset += b.length;
        }
        this.onSegment?.(mediaSegment, this.segmentIndex++);
        this.currentSegmentBuffers = [];
      }
    }
  }

  destroy() {
    this.buffer = new Uint8Array(0);
    this.initBuffers = [];
    this.currentSegmentBuffers = [];
    this.onInitSegment = undefined;
    this.onSegment = undefined;
  }
}

