import { getTranslations } from "next-intl/server";

export default async function CurrenciesSettingsPage() {
  const t = await getTranslations("Settings");
  return <h1 className="text-xl font-semibold">{t("currencies")}</h1>;
}
