// Minimal typing for the parts of pdfmake 0.3 (server build) KAIDLY uses.
declare module "pdfmake" {
  type Fonts = Record<string, { normal: string; bold: string; italics: string; bolditalics: string }>;
  interface OutputDocument {
    getBuffer(): Promise<Buffer>;
  }
  const pdfmake: {
    setFonts(fonts: Fonts): void;
    setUrlAccessPolicy(callback: (url: string) => boolean): void;
    setLocalAccessPolicy(callback: (path: string) => boolean): void;
    createPdf(docDefinition: Record<string, unknown>): OutputDocument;
  };
  export default pdfmake;
}
