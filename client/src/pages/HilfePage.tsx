import { Link } from 'react-router-dom';

export default function HilfePage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">&larr; Zurück</Link>
        <h1 className="text-xl font-bold text-[#1e3a5f]">Hilfe</h1>
      </div>

      <p className="text-sm text-gray-600">
        BOS-ARSA Log ist eine Echtzeit-Webanwendung zur Erfassung und Auswertung von Amateurfunk-Übungen.
        Mehrere Benutzer können gleichzeitig Signalrapporte auf verschiedenen Umsetzern und Frequenzen erfassen.
      </p>

      {/* ── Anmeldung ── */}
      <Section title="1. Anmeldung">
        <p>
          Beim Öffnen der App erscheint die Anmeldeseite. Geben Sie Ihren <b>Benutzernamen</b> und Ihr <b>Passwort</b> ein
          und klicken Sie auf <b>Anmelden</b>.
        </p>
        <p>
          Es gibt zwei Benutzerrollen:
        </p>
        <ul className="list-disc ml-5 space-y-1">
          <li><b>Admin</b> — Kann Übungen erstellen, Umsetzer konfigurieren, Übungsname/Datum ändern und alle Daten bearbeiten.</li>
          <li><b>Erfasser</b> — Kann Signalrapporte erfassen, bearbeiten und löschen. Kann keine Übungen erstellen oder Einstellungen ändern.</li>
        </ul>
        <p className="text-amber-700">
          Nach 10 fehlgeschlagenen Anmeldeversuchen wird die IP-Adresse für 15 Minuten gesperrt.
        </p>
      </Section>

      {/* ── Dashboard ── */}
      <Section title="2. Dashboard (Startseite)">
        <p>
          Nach der Anmeldung sehen Sie das Dashboard mit einer Übersicht aller Übungen.
        </p>
        <h4 className="font-semibold text-[#1e3a5f] mt-3">Statistik-Karten</h4>
        <p>
          Oben werden vier Kennzahlen angezeigt: <b>Übungen gesamt</b>, <b>Teilnehmer (Jahressumme)</b>,
          <b> Rapporte (Jahressumme)</b> und <b>Teilnehmer/Übung (Durchschnitt)</b>.
        </p>
        <h4 className="font-semibold text-[#1e3a5f] mt-3">Trend-Diagramm</h4>
        <p>
          Ein Balkendiagramm zeigt die Entwicklung von Teilnehmern und Rapporten über alle Übungen des Jahres.
        </p>
        <h4 className="font-semibold text-[#1e3a5f] mt-3">Übungstabelle</h4>
        <p>
          Jede Übung wird mit Datum, Name, Teilnehmeranzahl und Rapportanzahl aufgelistet.
          Die aktuelle Übung (nächste zum heutigen Datum oder in der Zukunft) ist blau hervorgehoben und mit <b>Aktuell</b> markiert.
          Quartals-Zwischensummen und ein Jahresgesamt werden automatisch berechnet.
        </p>
        <ul className="list-disc ml-5 space-y-1">
          <li><b>Öffnen</b> — Öffnet die Übung zur Datenerfassung.</li>
          <li><b>Auswertung</b> — Zeigt die statistische Auswertung der Übung.</li>
        </ul>
        <h4 className="font-semibold text-[#1e3a5f] mt-3">Neue Übung erstellen (nur Admin)</h4>
        <p>
          Klicken Sie auf <b>+ Neue Übung</b>. Wählen Sie ein Datum und einen Übungstyp
          (Krisenkommunikationsübung, Notfunkübung, Feldtag, Relaisfunktest oder eigener Name).
        </p>
      </Section>

      {/* ── Übung einrichten ── */}
      <Section title="3. Übung einrichten (Setup)">
        <p>
          Auf der Setup-Seite einer Übung werden die aktiven Umsetzer und Frequenzen konfiguriert.
        </p>
        <h4 className="font-semibold text-[#1e3a5f] mt-3">Bundesland-Auswahl (nur Admin)</h4>
        <p>
          Ein Raster mit 9 Buttons (OE1–OE9) zeigt die österreichischen Bundesländer.
          Ein Klick aktiviert/deaktiviert alle Umsetzer eines Bundeslandes.
          Jeder Button zeigt die Anzahl aktiver/gesamter Umsetzer.
        </p>
        <h4 className="font-semibold text-[#1e3a5f] mt-3">Umsetzer-Liste</h4>
        <p>
          Pro Bundesland werden alle verfügbaren Umsetzer mit Frequenz, Offset und CTCSS-Ton angezeigt.
          Umsetzer können einzeln per Checkbox aktiviert/deaktiviert werden (nur Admin).
          Verlinkte Umsetzer (OE-Link) sind mit einem blauen Badge gekennzeichnet.
        </p>
        <h4 className="font-semibold text-[#1e3a5f] mt-3">Eigene Umsetzer hinzufügen</h4>
        <p>
          Mit <b>+ Umsetzer hinzufügen</b> kann ein benutzerdefinierter Umsetzer erstellt werden.
          Das Band (2m/70cm/23cm) wird automatisch anhand der Frequenz erkannt.
        </p>
        <h4 className="font-semibold text-[#1e3a5f] mt-3">Simplex-Frequenzen</h4>
        <p>
          Unterhalb der Umsetzer gibt es einen eigenen Bereich für Simplex-Frequenzen (z.B. 145.500 MHz).
          Eigene Simplex-Frequenzen können mit <b>+ Simplex-Frequenz hinzufügen</b> ergänzt werden.
        </p>
        <h4 className="font-semibold text-[#1e3a5f] mt-3">OE-Link</h4>
        <p>
          Die Checkbox <b>OE-Link</b> aktiviert den OE-Link-Modus.
          In diesem Modus erscheint auf der Übungsseite ein zusätzlicher Tab für die OE-Link-Erfassung.
        </p>
      </Section>

      {/* ── Datenerfassung ── */}
      <Section title="4. Datenerfassung (Übungsseite)">
        <p>
          Die Übungsseite ist das Herzstück der Anwendung. Hier werden Signalrapporte live erfasst.
        </p>
        <h4 className="font-semibold text-[#1e3a5f] mt-3">Organisator</h4>
        <p>
          Das Feld <b>Organisator</b> (oben) enthält das Rufzeichen des Übungsleiters.
          Es wird automatisch in Großbuchstaben umgewandelt und beim Verlassen des Feldes gespeichert.
        </p>
        <h4 className="font-semibold text-[#1e3a5f] mt-3">Laufende Statistik</h4>
        <p>
          Eine fixierte Leiste am oberen Rand zeigt ständig aktualisiert:
        </p>
        <ul className="list-disc ml-5 space-y-1">
          <li><b>Anwesend</b> — Anzahl der anwesenden Teilnehmer</li>
          <li><b>Rapporte</b> — Gesamtzahl der Rapporte</li>
          <li>Pro Umsetzer die Anzahl der Rapporte</li>
        </ul>

        <h4 className="font-semibold text-[#1e3a5f] mt-3">Modus: Frequenzen (Land)</h4>
        <p>
          Die Rapporte sind nach <b>Umsetzer</b> gruppiert, dann nach <b>Bezirk</b>.
          Jede Umsetzer-Karte zeigt:
        </p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Umsetzername, Frequenz, Offset, CTCSS</li>
          <li><b>OP-Rufzeichen</b> — Das Rufzeichen des zuständigen Operators für diesen Umsetzer</li>
          <li>Pro Bezirk: Bezirk-Code (rot = Landeshauptstadt), vorhandene Rapporte, Eingabeformular</li>
        </ul>

        <h4 className="font-semibold text-[#1e3a5f] mt-3">Modus: OE-Link (Bund)</h4>
        <p>
          Nur sichtbar wenn OE-Link aktiviert ist. Die Rapporte sind nach <b>Bundesland</b> gruppiert, dann nach <b>Bezirk</b>.
          Pro Bezirk kann der Einstiegspunkt (verlinkter Umsetzer) ausgewählt werden.
        </p>

        <h4 className="font-semibold text-[#1e3a5f] mt-3">Rapport eingeben</h4>
        <p>
          Jeder Bezirk hat ein Eingabeformular mit drei Feldern:
        </p>
        <ul className="list-disc ml-5 space-y-1">
          <li><b>Rufzeichen</b> — Eingabe mit Autovervollständigung. Wird das Rufzeichen nicht gefunden, wird der Operator automatisch neu angelegt.</li>
          <li><b>RST</b> — Signalrapport im Format R/S, z.B. „5/9", „4/7+20"</li>
          <li><b>Bemerkung</b> — Optionale Notiz</li>
        </ul>
        <p>
          Mit <b>Enter</b> oder dem <b>+</b>-Button wird der Rapport gespeichert.
          Die Felder werden automatisch geleert und der Fokus springt zurück zum Rufzeichen-Feld.
        </p>

        <h4 className="font-semibold text-[#1e3a5f] mt-3">Rapport bearbeiten</h4>
        <p>
          Klicken Sie auf einen bestehenden Rapport (Rufzeichen, RST oder Bemerkung), um ihn inline zu bearbeiten.
          Bestätigen mit <b>OK</b>, abbrechen mit <b>X</b>.
        </p>

        <h4 className="font-semibold text-[#1e3a5f] mt-3">Rapport löschen</h4>
        <p>
          Der <b>x</b>-Button rechts neben einem Rapport löscht ihn nach Bestätigung.
        </p>

        <h4 className="font-semibold text-[#1e3a5f] mt-3">Echtzeit-Synchronisation</h4>
        <p>
          Alle Änderungen werden in Echtzeit an alle angemeldeten Benutzer übertragen.
          Wenn ein Kollege einen Rapport eingibt, erscheint er sofort auch auf Ihrem Bildschirm.
        </p>
      </Section>

      {/* ── Tastaturkürzel ── */}
      <Section title="5. Tastaturkürzel">
        <p>Die folgenden Kürzel beschleunigen die Eingabe bei der Datenerfassung:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 mt-2">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 border-b font-semibold">Kürzel</th>
                <th className="text-left px-3 py-2 border-b font-semibold">Aktion</th>
              </tr>
            </thead>
            <tbody>
              <Shortcut keys="Alt + 1 bis Alt + 9" desc='Trägt "5/1" bis "5/9" im RST-Feld ein' />
              <Shortcut keys="Strg + 1 bis Strg + 9" desc='Trägt "OE1" bis "OE9" im Rufzeichen-Feld ein' />
              <Shortcut keys="Enter" desc="Rapport absenden und Felder leeren" />
              <Shortcut keys="Pfeil hoch / runter" desc="Autovervollständigungs-Vorschläge navigieren" />
              <Shortcut keys="Escape" desc="Autovervollständigung schließen" />
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Auswertung ── */}
      <Section title="6. Auswertung & Export">
        <p>
          Es gibt zwei Auswertungsmöglichkeiten: eine <b>Einzelauswertung</b> pro Übung und eine
          übergreifende <b>Auswertung</b> über einen frei wählbaren Zeitraum.
        </p>

        <h4 className="font-semibold text-[#1e3a5f] mt-3">Auswertung (Zeitraum-Auswertung)</h4>
        <p>
          Über den Navigationspunkt <b>Auswertung</b> gelangen Sie zur Zeitraum-Auswertung.
          Hier werden die Daten aller Übungen in einem Zeitraum zusammengefasst.
        </p>
        <ul className="list-disc ml-5 space-y-1">
          <li><b>Schnellauswahl</b> — Buttons für Q1, Q2, Q3, Q4 und das gesamte Jahr</li>
          <li><b>Eigener Zeitraum</b> — Mit den Feldern Von / Bis kann ein beliebiger Zeitraum gewählt werden</li>
          <li><b>Übersichtskarten</b> — Teilnehmer (eindeutig über alle Übungen), Rapporte, Anzahl Übungen, Ø Teilnehmer/Übung</li>
          <li><b>Übungsliste</b> — Aufklappbare Liste aller enthaltenen Übungen mit Einzelwerten</li>
          <li>Karte, Diagramme, Tabellen und Teilnehmerliste wie bei der Einzelauswertung</li>
          <li><b>Download Auswertung (PNG)</b> — Die gesamte Auswertung als Bild herunterladen</li>
          <li><b>Download ADIF</b> — QSO-Daten im ADIF-Format (.adi) für den Import in QRZ.com, LOTW oder andere Logbuch-Software</li>
        </ul>

        <h4 className="font-semibold text-[#1e3a5f] mt-3">Einzelauswertung (pro Übung)</h4>
        <p>
          Die Einzelauswertung zeigt statistische Grafiken und Tabellen für eine einzelne Übung.
          Sie ist über den Button <b>Auswertung</b> in der Übungstabelle auf dem Dashboard erreichbar.
        </p>
        <h4 className="font-semibold text-[#1e3a5f] mt-3">Karte</h4>
        <p>
          Eine interaktive Karte zeigt Österreich mit allen 9 Bundesländern und den 9 Nachbarländern
          (Deutschland, Tschechien, Slowakei, Ungarn, Slowenien, Italien, Schweiz, Liechtenstein, Kroatien).
          Die Farbintensität zeigt die Anzahl der Teilnehmer pro Region.
          Beim Überfahren mit der Maus werden Teilnehmer- und Rapportanzahl angezeigt.
        </p>
        <h4 className="font-semibold text-[#1e3a5f] mt-3">Diagramme</h4>
        <ul className="list-disc ml-5 space-y-1">
          <li><b>Balkendiagramm</b> — Stationen und Rapporte pro Bezirk/Bundesland/Land</li>
          <li><b>Kreisdiagramm</b> — Rapporte Verteilung nach Bundesland / Land</li>
        </ul>
        <p>
          Jedes Diagramm kann einzeln als PNG-Bild heruntergeladen werden.
        </p>
        <h4 className="font-semibold text-[#1e3a5f] mt-3">Tabellen</h4>
        <ul className="list-disc ml-5 space-y-1">
          <li><b>Bezirk-Tabelle</b> — Aufschlüsselung nach Bundesland / Land und Bezirk mit Zwischensummen</li>
          <li><b>Teilnehmerliste</b> — Aufklappbare Liste aller Teilnehmer mit Rufzeichen, Name, Bezirk, Bundesland / Land und Rapportanzahl</li>
        </ul>
        <h4 className="font-semibold text-[#1e3a5f] mt-3">Export-Formate</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 mt-2">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 border-b font-semibold">Format</th>
                <th className="text-left px-3 py-2 border-b font-semibold">Beschreibung</th>
              </tr>
            </thead>
            <tbody>
              <Shortcut keys="PNG Auswertung" desc="Screenshot der gesamten Auswertungsseite" />
              <Shortcut keys="ADIF (.adi)" desc="QSO-Daten für QRZ.com, LOTW und andere Logbuch-Software" />
              <Shortcut keys="TXT — OE-Link" desc="Textdatei, gruppiert nach Bundesland und Bezirk" />
              <Shortcut keys="TXT — Frequenzen" desc="Textdatei, gruppiert nach Umsetzer und Bezirk" />
              <Shortcut keys="TXT — Kombiniert" desc="Zusammenfassung mit Statistiken und Umsetzer-Aufschlüsselung" />
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Rufzeichen-Verwaltung ── */}
      <Section title="7. Rufzeichen-Verwaltung">
        <p>
          Unter <b>Rufzeichen</b> in der Navigation finden Sie die Operator-Datenbank.
        </p>
        <h4 className="font-semibold text-[#1e3a5f] mt-3">Suche</h4>
        <p>
          Das Suchfeld durchsucht Rufzeichen, Name und QTH gleichzeitig. Die Suche startet automatisch
          nach kurzer Verzögerung (300ms).
        </p>
        <h4 className="font-semibold text-[#1e3a5f] mt-3">Neuen Operator anlegen</h4>
        <p>
          Mit <b>+ Neu</b> können Sie manuell einen neuen Operator anlegen (Rufzeichen, Name, QTH, Bezirk, Bundesland).
          Operatoren werden auch automatisch angelegt, wenn ein unbekanntes Rufzeichen bei der Datenerfassung eingegeben wird.
        </p>
        <h4 className="font-semibold text-[#1e3a5f] mt-3">Automatische Länderzuordnung</h4>
        <p>
          Das Bundesland bzw. Nachbarland wird automatisch anhand des Rufzeichen-Präfixes zugeordnet
          (z.B. OE8 → Kärnten, S55 → Slowenien, DL → Deutschland).
          Suffixe wie /P, /M oder /OE8 werden dabei ignoriert.
        </p>
        <h4 className="font-semibold text-[#1e3a5f] mt-3">Automatische Bezirkszuordnung</h4>
        <p>
          Der <b>Bezirk</b> (Heimatbezirk) wird nach Möglichkeit automatisch aus dem QTH (Standort) abgeleitet
          (z.B. „Graz" → GC, „Wien" → WC, „Mödling" → MD). Wenn keine Zuordnung möglich ist,
          kann der Bezirk manuell gesetzt werden.
        </p>
        <h4 className="font-semibold text-[#1e3a5f] mt-3">Bezirk in Rapports vs. Rufzeichenliste</h4>
        <p>
          Der <b>Heimatbezirk</b> eines Operators (in der Rufzeichenliste) und der <b>Rapport-Bezirk</b> (wo der Rapport
          abgegeben wurde) sind unabhängig voneinander. Ein Operator kann reisen und von jedem Bezirk aus
          einen Rapport abgeben, ohne dass sein Heimatbezirk verändert wird.
          Auswertungen, Exporte und Diagramme gruppieren nach dem Rapport-Bezirk.
        </p>
        <h4 className="font-semibold text-[#1e3a5f] mt-3">Operator bearbeiten</h4>
        <p>
          Klicken Sie auf <b>Bearb.</b> in der Operatoren-Tabelle, um alle Felder inline zu bearbeiten.
          Bestätigen Sie mit dem Häkchen oder brechen Sie mit X ab.
        </p>
      </Section>

      {/* ── Rufzeichen-Import ── */}
      <Section title="8. Rufzeichen-Import (Fernmeldebehörde)">
        <p>
          Rufzeichen können aus der offiziellen <b>Rufzeichenliste der Fernmeldebehörde</b> (PDF) automatisch
          importiert werden. Das Skript liest die PDF-Datei, extrahiert Rufzeichen, Name und Standort (QTH)
          und aktualisiert die Operator-Datenbank.
        </p>
        <h4 className="font-semibold text-[#1e3a5f] mt-3">Importmodus</h4>
        <ul className="list-disc ml-5 space-y-1">
          <li><b>RUFZEICHEN_MODE=update</b> — Neue Rufzeichen einfügen, bestehende mit Name/QTH aktualisieren (Standard)</li>
          <li><b>RUFZEICHEN_MODE=skip</b> — Nur neue Rufzeichen einfügen, bestehende nicht verändern</li>
        </ul>
        <h4 className="font-semibold text-[#1e3a5f] mt-3">Ausführung</h4>
        <p>
          Das Bundesland wird automatisch aus dem Rufzeichen-Präfix abgeleitet (OE1 = Wien, OE8 = Kärnten, usw.).
          Gesperrte Rufzeichen (<code>*-*-*</code>) werden übersprungen.
          Der Import ist idempotent — bei unverändertem Datenbestand werden keine Änderungen vorgenommen.
        </p>
        <p>
          Voraussetzung: <code>pdftotext</code> (poppler-utils) muss installiert sein.
        </p>
      </Section>

      {/* ── Rollen ── */}
      <Section title="9. Benutzerrollen">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 mt-2">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 border-b font-semibold">Funktion</th>
                <th className="text-center px-3 py-2 border-b font-semibold">Admin</th>
                <th className="text-center px-3 py-2 border-b font-semibold">Erfasser</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <RoleRow label="Übung erstellen" admin operator={false} />
              <RoleRow label="Übungsname/Datum ändern" admin operator={false} />
              <RoleRow label="Umsetzer konfigurieren" admin operator={false} />
              <RoleRow label="OE-Link aktivieren" admin operator={false} />
              <RoleRow label="Bundesländer aktivieren" admin operator={false} />
              <RoleRow label="Rapporte erfassen" admin operator />
              <RoleRow label="Rapporte bearbeiten/löschen" admin operator />
              <RoleRow label="Operatoren verwalten" admin operator />
              <RoleRow label="Auswertung ansehen" admin operator />
              <RoleRow label="Daten exportieren" admin operator />
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── Tipps ── */}
      <Section title="10. Tipps für die Praxis">
        <ul className="list-disc ml-5 space-y-2">
          <li>
            <b>Vor der Übung:</b> Admin erstellt die Übung, wählt die Bundesländer und aktiviert die benötigten Umsetzer.
            OP-Rufzeichen pro Umsetzer eintragen.
          </li>
          <li>
            <b>Während der Übung:</b> Alle Erfasser melden sich an und öffnen die Übung.
            Rapporte werden live synchronisiert — jeder sieht sofort, was die anderen eingeben.
          </li>
          <li>
            <b>Schnelle Eingabe:</b> Nutzen Sie Alt+1-9 für schnelle RST-Eingabe und Strg+1-9 für OE-Präfixe.
            Nach Enter springt der Fokus automatisch zum nächsten Rufzeichen-Feld.
          </li>
          <li>
            <b>Unbekannte Rufzeichen:</b> Wenn ein Rufzeichen nicht in der Datenbank ist, wird es beim Speichern
            automatisch als neuer Operator angelegt.
          </li>
          <li>
            <b>Nach der Übung:</b> Auf der Auswertungsseite können Diagramme und Textdateien exportiert werden.
          </li>
        </ul>
      </Section>

      <div className="text-xs text-gray-400 pt-4 border-t">
        BOS-ARSA Log &mdash; Im Sinne der Sicherheit
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold text-[#1e3a5f] border-b border-gray-200 pb-1">{title}</h2>
      <div className="text-sm text-gray-700 space-y-2">{children}</div>
    </section>
  );
}

function Shortcut({ keys, desc }: { keys: string; desc: string }) {
  return (
    <tr className="border-b border-gray-100">
      <td className="px-3 py-1.5 font-mono text-xs whitespace-nowrap">{keys}</td>
      <td className="px-3 py-1.5">{desc}</td>
    </tr>
  );
}

function RoleRow({ label, admin, operator }: { label: string; admin: boolean; operator: boolean }) {
  return (
    <tr>
      <td className="px-3 py-1.5">{label}</td>
      <td className="px-3 py-1.5 text-center">{admin ? '✓' : '—'}</td>
      <td className="px-3 py-1.5 text-center">{operator ? '✓' : '—'}</td>
    </tr>
  );
}
