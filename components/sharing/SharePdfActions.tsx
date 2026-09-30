"use client";

import { Download, MessageCircle, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

type SharePdfActionsProps = {
  pdf: Blob;
  pdfUrl: string;
  fileName: string;
  title: string;
  documentNumber: string;
};

export function SharePdfActions({ pdf, pdfUrl, fileName, title, documentNumber }: SharePdfActionsProps) {
  const [supportsFileShare, setSupportsFileShare] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") {
      setSupportsFileShare(false);
      return;
    }

    try {
      const file = new File([pdf], fileName, { type: "application/pdf" });
      setSupportsFileShare(navigator.canShare({ files: [file] }));
    } catch {
      setSupportsFileShare(false);
    }
  }, [fileName, pdf]);

  async function sharePdf() {
    const file = new File([pdf], fileName, { type: "application/pdf" });
    try {
      await navigator.share({ files: [file], title });
      setShareMessage("PDF shared.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setShareMessage("Sharing did not open. Download the PDF or use the WhatsApp message instead.");
    }
  }

  const whatsappMessage = `${title} ${documentNumber} is ready. I will share the PDF separately.`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className="share-actions">
      <div className="preview-actions">
        {supportsFileShare && (
          <button className="preview-action share-action" type="button" onClick={sharePdf}>
            <Share2 size={15} aria-hidden="true" />
            Share PDF
          </button>
        )}
        <a className="preview-action download-action" href={pdfUrl} download={fileName}>
          <Download size={15} aria-hidden="true" />
          Download PDF
        </a>
        <a className="preview-action whatsapp-action" href={whatsappUrl} target="_blank" rel="noreferrer">
          <MessageCircle size={15} aria-hidden="true" />
          WhatsApp
        </a>
      </div>
      <p className="share-note">WhatsApp opens a message; attach the downloaded PDF yourself.</p>
      {shareMessage && <p className="share-status" role="status">{shareMessage}</p>}
    </div>
  );
}