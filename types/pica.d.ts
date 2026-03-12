declare module "pica" {
  interface PicaResizeOptions {
    src: HTMLCanvasElement;
    dest: HTMLCanvasElement;
    quality?: number;
    alpha?: boolean;
    unsharpAmount?: number;
    unsharpRadius?: number;
    unsharpThreshold?: number;
    transferable?: boolean;
  }

  interface PicaToBlobOptions {
    quality?: number;
  }

  class Pica {
    constructor(options?: Record<string, unknown>);
    resize(
      from: HTMLCanvasElement | HTMLImageElement,
      to: HTMLCanvasElement,
      options?: Partial<PicaResizeOptions>
    ): Promise<HTMLCanvasElement>;
    toBlob(
      canvas: HTMLCanvasElement,
      mimeType: string,
      quality?: number
    ): Promise<Blob>;
  }

  export default Pica;
}
