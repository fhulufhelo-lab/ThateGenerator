import { companyConfig } from "./company-config";
import type { Document, DocumentRequest } from "./document";

export function createDocument(request: DocumentRequest): Document {
  return {
    ...request,
    registrationNumber: companyConfig.registrationNumber,
    vatNumber: companyConfig.vatNumber,
    supplier: {
      addressLine1: companyConfig.address[0],
      addressLine2: companyConfig.address[1],
      addressLine3: companyConfig.address[2],
    },
    contact: {
      ...request.contact,
      telephone: companyConfig.telephone,
    },
  };
}