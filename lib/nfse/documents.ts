import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import type { invoices, projects } from "../db/schema";
import { formatCnpj } from "../cnpj";
import { formatBRL, formatWhen, parseJson } from "../format";
import { STUDY_AVISO } from "../plan";

type Invoice = typeof invoices.$inferSelect;
type Project = typeof projects.$inferSelect;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tagName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_.-]/g, "");
  if (!cleaned || /^[0-9]/.test(cleaned)) return "campo";
  return cleaned;
}

function toXml(name: string, value: unknown): string {
  if (value == null || value === "") return "";
  const tag = tagName(name);
  if (Array.isArray(value)) return value.map((item) => toXml(tag, item)).join("");
  if (typeof value === "object") {
    const inner = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => toXml(key, item))
      .join("");
    return `<${tag}>${inner}</${tag}>`;
  }
  return `<${tag}>${escapeXml(String(value))}</${tag}>`;
}

export function buildXml(invoice: Invoice, project: Project, kind: "emission" | "cancel"): string {
  const payload = parseJson<Record<string, unknown>>(invoice.payloadJson, {});
  if (kind === "cancel") {
    return `<?xml version="1.0" encoding="UTF-8"?>
<NfseEstudoCancelamento simulado="true">
  <aviso>${escapeXml(STUDY_AVISO)} Este XML não segue o leiaute oficial.</aviso>
  <prestador><cnpj>${project.cnpj}</cnpj><razaoSocial>${escapeXml(project.razaoSocial)}</razaoSocial></prestador>
  <numero>${escapeXml(invoice.numeroNfse ?? "")}</numero>
  <codigoVerificacao>${escapeXml(invoice.chNfse ?? "")}</codigoVerificacao>
  <motivo>${escapeXml(invoice.cancelMotivo ?? "")}</motivo>
  <canceladoEm>${invoice.cancelledAt ? new Date(invoice.cancelledAt).toISOString() : ""}</canceladoEm>
</NfseEstudoCancelamento>
`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<NfseEstudo simulado="true">
  <aviso>${escapeXml(STUDY_AVISO)} O código de verificação é interno da bancada e não é chave oficial.</aviso>
  <prestador>
    <cnpj>${project.cnpj}</cnpj>
    <razaoSocial>${escapeXml(project.razaoSocial)}</razaoSocial>
    <inscricaoMunicipal>${escapeXml(project.inscricaoMunicipal ?? "")}</inscricaoMunicipal>
  </prestador>
  <numero>${escapeXml(invoice.numeroNfse ?? "")}</numero>
  <serie>${escapeXml(invoice.serie ?? "")}</serie>
  <codigoVerificacao>${escapeXml(invoice.chNfse ?? "")}</codigoVerificacao>
  <status>${invoice.status}</status>
  <competencia>${escapeXml(invoice.competencia ?? "")}</competencia>
  ${toXml("payload", payload)}
</NfseEstudo>
`;
}

function drawLine(
  page: ReturnType<PDFDocument["addPage"]>,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  text: string,
  x: number,
  y: number,
  size = 11,
) {
  page.drawText(text, { x, y, size, font, color: rgb(0.12, 0.1, 0.08) });
}

export async function buildPdf(invoice: Invoice, project: Project): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("NFS-e de estudo SEM VALOR FISCAL");
  pdf.setSubject("Documento didatico. Nao e nota oficial.");
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const payload = parseJson<{
    tomador?: { nome?: string; cnpj?: string; cpf?: string; email?: string };
    servico?: { descricao?: string; codigo?: string; informacoesComplementares?: string };
    valores?: { total?: number; aliquotaIss?: number; issRetido?: boolean };
  }>(invoice.payloadJson, {});

  page.drawRectangle({ x: 0, y: 800, width: 595, height: 42, color: rgb(0.55, 0.16, 0.14) });
  page.drawText("SEM VALOR FISCAL  ·  AMBIENTE DE ESTUDO  ·  NAO E DOCUMENTO OFICIAL", {
    x: 28,
    y: 816,
    size: 9,
    font: bold,
    color: rgb(1, 1, 1),
  });

  page.drawText("NFS-e de estudo", { x: 40, y: 760, size: 22, font: bold, color: rgb(0.08, 0.32, 0.27) });
  drawLine(page, font, "Representação didática. Nada foi enviado a um órgão público.", 40, 738, 10);

  if (project.logoDataUrl?.startsWith("data:image/png") || project.logoDataUrl?.startsWith("data:image/jpeg")) {
    try {
      const bytes = Buffer.from(project.logoDataUrl.split(",")[1] ?? "", "base64");
      const image = project.logoDataUrl.startsWith("data:image/png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const width = 72;
      const height = (image.height / image.width) * width;
      page.drawImage(image, { x: 480, y: 730, width, height: Math.min(height, 72) });
    } catch {
      drawLine(page, font, "Logo ignorada no PDF.", 430, 730, 8);
    }
  }

  let y = 700;
  const block = (title: string, lines: string[]) => {
    page.drawText(title, { x: 40, y, size: 12, font: bold, color: rgb(0.08, 0.32, 0.27) });
    y -= 18;
    for (const line of lines) {
      const chunks = line.length > 90 ? [line.slice(0, 90), line.slice(90, 180)] : [line];
      for (const chunk of chunks) {
        if (!chunk) continue;
        drawLine(page, font, chunk, 40, y, 11);
        y -= 16;
      }
    }
    y -= 8;
  };

  block("Prestador", [
    project.razaoSocial,
    `CNPJ ${formatCnpj(project.cnpj)}`,
    project.inscricaoMunicipal ? `IM ${project.inscricaoMunicipal}` : "IM não informada",
  ]);
  block("Tomador", [
    payload.tomador?.nome ?? invoice.tomadorNome,
    payload.tomador?.cnpj ? `CNPJ ${payload.tomador.cnpj}` : payload.tomador?.cpf ? `CPF ${payload.tomador.cpf}` : "Documento não informado",
    payload.tomador?.email ? `E-mail ${payload.tomador.email}` : "Sem e-mail",
  ]);
  block("Serviço", [
    payload.servico?.descricao ?? "",
    payload.servico?.codigo ? `Código ${payload.servico.codigo}` : "Sem código de serviço",
    `Competência ${invoice.competencia ?? "—"}`,
  ]);
  block("Valores de estudo", [
    `Total ${formatBRL(Number(payload.valores?.total ?? invoice.valorTotal))}`,
    `Alíquota ISS informada ${payload.valores?.aliquotaIss ?? 0}%`,
    `ISS retido: ${payload.valores?.issRetido ? "sim" : "não"}`,
    "Não há cálculo tributário neste laboratório.",
  ]);
  block("Identificação interna", [
    `Número ${invoice.numeroNfse ?? "—"}   Série ${invoice.serie ?? "—"}`,
    `Código de verificação ${invoice.chNfse ?? "—"}`,
    "Este código não consulta portal oficial.",
    invoice.status === "cancelled" ? `Cancelada em ${formatWhen(invoice.cancelledAt)}` : `Emitida em ${formatWhen(invoice.issuedAt)}`,
  ]);
  if (payload.servico?.informacoesComplementares) {
    block("Informações complementares", [String(payload.servico.informacoesComplementares)]);
  }

  page.drawText("SEM VALOR FISCAL", {
    x: 90,
    y: 360,
    size: 42,
    font: bold,
    color: rgb(0.7, 0.2, 0.16),
    rotate: degrees(-28),
    opacity: 0.18,
  });

  page.drawText(STUDY_AVISO, { x: 40, y: 36, size: 8, font, color: rgb(0.35, 0.28, 0.22) });
  return pdf.save({ useObjectStreams: false });
}
