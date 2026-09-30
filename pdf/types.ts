export type FontKey = "body" | "bold" | "contact";
export type TextAlignment = "left" | "center" | "right";

export type PdfFieldDefinition = {
  page: number;
  bbox: [number, number, number, number];
  font: FontKey;
  fontSize: number;
  align: TextAlignment;
  rowStep?: number;
  evidence?: string;
};

export type ContinuationFieldDefinition = Omit<PdfFieldDefinition, "page">;

export type OverlayMap = {
  templateVersion: string;
  page: {
    count: number;
    width: number;
    height: number;
    units: "pt";
    origin: "top-left";
  };
  fonts: Record<FontKey, string>;
  fields: Record<string, PdfFieldDefinition>;
  continuation: {
    evidence: string;
    itemCapacity: number;
    titleBand: [number, number, number, number];
    tableHeaderBand: [number, number, number, number];
    tableBodyTop: number;
    tableBodyBottom: number;
    rowHeight: number;
    rowTextTop: number;
    rowTextStep: number;
    verticalRules: number[];
    horizontalRuleThickness: number;
    headerFill: [number, number, number];
    titleFill: [number, number, number];
    title: ContinuationFieldDefinition;
    documentNumber: ContinuationFieldDefinition;
    headers: Record<string, ContinuationFieldDefinition>;
    totals: {
      firstRowTop: number;
      rowStep: number;
      labelRight: number;
      amountLeft: number;
      amountRight: number;
    };
  };
};