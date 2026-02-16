import { Link } from 'react-router-dom';

export default function DatenschutzPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">&larr; Zurück</Link>
        <h1 className="text-xl font-bold text-[#1a365d]">Datenschutzerklärung</h1>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[#1a365d]">Datenschutz auf einen Blick</h2>
        <p className="text-sm text-gray-700">
          Diese Anwendung speichert Daten, die für die Durchführung von Krisenkommunikationsübungen erforderlich sind (Rufzeichen, Signalrapporte, Übungsdaten). Es werden keine Cookies zu Tracking-Zwecken gesetzt.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[#1a365d]">Datenerfassung</h2>
        <p className="text-sm text-gray-700">
          Die Anwendung erfasst Amateurfunk-Rufzeichen, Signalrapporte und Übungsdaten. Diese Daten dienen ausschließlich der Dokumentation und Auswertung von Krisenkommunikationsübungen. Eine Weitergabe an Dritte findet nicht statt.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[#1a365d]">Hosting</h2>
        <p className="text-sm text-gray-700">
          Diese Website wird über Cloudflare bereitgestellt. Cloudflare kann technische Zugriffsdaten (IP-Adresse, Zeitpunkt) in Server-Logs speichern. Details finden Sie in der Datenschutzerklärung von Cloudflare.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[#1a365d]">Ihre Rechte</h2>
        <p className="text-sm text-gray-700">
          Sie haben das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung Ihrer Daten. Wenden Sie sich dazu an den Betreiber unter <a href="mailto:oe8yml@rednil.at" className="text-blue-700 hover:underline">oe8yml@rednil.at</a>.
        </p>
      </section>
    </div>
  );
}
