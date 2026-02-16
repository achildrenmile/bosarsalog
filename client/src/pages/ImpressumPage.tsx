import { Link } from 'react-router-dom';

export default function ImpressumPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">&larr; Zurück</Link>
        <h1 className="text-xl font-bold text-[#1e3a5f]">Impressum</h1>
      </div>

      <p className="text-sm text-gray-500">Angaben gemäß § 5 ECG und § 25 MedienG</p>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[#1e3a5f]">Inhaber / Betreiber</h2>
        <div className="text-sm text-gray-700">
          <p className="font-medium">Michael Linder</p>
          <p>OE8YML</p>
          <p>Nötsch 219, 9611 Nötsch</p>
          <p>Österreich</p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[#1e3a5f]">Kontakt</h2>
        <p className="text-sm">
          <a href="mailto:oe8yml@rednil.at" className="text-blue-700 hover:underline">oe8yml@rednil.at</a>
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[#1e3a5f]">Haftung für Inhalte</h2>
        <p className="text-sm text-gray-700">
          Die Inhalte dieser Website wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte übernehmen wir jedoch keine Gewähr. Diese Website dient ausschließlich der Dokumentation und Koordination von Amateurfunk-Krisenkommunikationsübungen.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[#1e3a5f]">Urheberrecht</h2>
        <p className="text-sm text-gray-700">
          Die durch den Betreiber erstellten Inhalte und Werke auf dieser Website unterliegen dem österreichischen Urheberrecht.
        </p>
      </section>
    </div>
  );
}
