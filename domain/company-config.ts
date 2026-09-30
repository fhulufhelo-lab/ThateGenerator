export type CompanyConfig = {
  name: string;
  registrationNumber: string;
  vatNumber: string;
  address: readonly [string, string, string];
  telephone: string;
  bank: string;
  accountNumber: string;
  accountType: string;
};

export const companyConfig: CompanyConfig = {
  name: "THATE ELCTRICAL SUPPLIES",
  registrationNumber: "2007/210672/23",
  vatNumber: "4220270799",
  address: ["Power park building", "No: 50 Reitfontein Road", "Primrose, 1401"],
  telephone: "(011) 026 1210",
  bank: "First National Bank",
  accountNumber: "62193132760",
  accountType: "Cheque",
};