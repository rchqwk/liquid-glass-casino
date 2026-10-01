import { notFound } from "next/navigation";
import { CasinoUiPreview } from "./preview";

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <CasinoUiPreview />;
}
