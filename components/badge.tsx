import { STATUS_LABEL } from "@/lib/format";

export function Badge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{STATUS_LABEL[status] ?? status}</span>;
}
