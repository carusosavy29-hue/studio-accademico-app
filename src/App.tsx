import { useEffect, useMemo, useRef, useState } from 'react';

type Subject = {
  id: string;
  name: string;
  notes: string;
  color: string;
};

type WrittenResult = {
  id: string;
  subjectId: string;
  question: string;
  answer: string;
  score: number;
  corrections: string[];
  date: string;
};

type OralResult = {
  id: string;
  subjectId: string;
  question: string;
  answer: string;
  score: number;
  date: string;
};

type WrittenSheet = {
  question: string;
  answer: string;
  score: number;
  corrections: string[];
};

type SubjectReport = {
  subject: Subject;
  writtenAvg: number;
  oralAvg: number;
  overall: number;
};

const STORAGE_KEY = 'academia-digitale-state-v1';

const initialSubjects: Subject[] = [
  {
    id: 'architettura-calcolatori',
    name: 'Architettura dei Calcolatori',
    color: '#8b5cf6',
    notes:
      'Il processore legge le istruzioni dal bus, utilizza la cache per ridurre i tempi di accesso alla memoria e coordina le operazioni con lunità di controllo. La memoria centrale contiene dati e codice, mentre il bus collega CPU, RAM e dispositivi I/O. La pipeline migliora le prestazioni consentendo multiple istruzioni in esecuzione contemporanea. La gerarchia della memoria include registri, cache, RAM e memoria secondaria.',
  },
  {
    id: 'algoritmi',
    name: 'Algoritmi',
    color: '#14b8a6',
    notes:
      'La complessità temporale descrive il tempo necessario a risolvere un problema in funzione della dimensione dellinput. Un algoritmo divide et impera suddivide il problema in sottoproblemi indipendenti e li combina. La ricerca lineare ha complessità O(n), mentre la ricerca binaria richiede dati ordinati e ha complessità O(log n). Le strutture dati come array, liste e code influenzano le prestazioni.',
  },
  {
    id: 'cloud',
    name: 'Cloud Computing',
    color: '#f59e0b',
    notes:
      'I servizi cloud includono IaaS, PaaS e SaaS secondo il livello di astrazione offerto. La scalabilità orizzontale aggiunge nuove istanze mentre la scalabilità verticale aumenta le risorse di un nodo. La virtualizzazione separa risorse hardware da sistemi operativi e applicazioni, migliorando efficienza e disponibilità. Le reti di distribuzione e i container semplificano il deployment di applicazioni moderne.',
  },
  {
    id: 'cybersecurity',
    name: 'Sicurezza Informatica',
    color: '#f43f5e',
    notes:
      'La sicurezza informatica protegge dati, sistemi e servizi da minacce interne ed esterne. La crittografia simmetrica usa una chiave condivisa, mentre la crittografia asimmetrica usa coppie di chiavi pubblica e privata. Un firewall filtra il traffico di rete, mentre un IDS rileva comportamenti sospetti. La gestione delle policy e del rischio riduce la probabilità di attacchi di phishing e malware.',
  },
];

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const average = (values: number[]) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const buildKeywords = (notes: string) => {
  const words = normalizeText(notes).split(' ');
  const filtered = words.filter((word) => word.length > 4 && !['della', 'dalle', 'dello', 'questo', 'quando', 'mentre', 'principale', 'rispetto'].includes(word));
  return Array.from(new Set(filtered)).slice(0, 14);
};

const generateWrittenQuestion = (subject: Subject) => {
  const notes = subject.notes.trim();
  const sentences = notes.split(/(?<=[.!?])\s+/).filter(Boolean);
  const focusSentence = sentences.find((entry) => entry.length > 60) ?? notes;
  const snippet = focusSentence.length > 120 ? `${focusSentence.slice(0, 120)}...` : focusSentence;

  return `Spiega in modo chiaro e dettagliato il seguente concetto di ${subject.name}: ${snippet}. Descrivi il contesto, il principio di funzionamento e un esempio pratico.`;
};

const gradeWritten = (subject: Subject, answer: string) => {
  const normalizedAnswer = normalizeText(answer);
  const noteWords = buildKeywords(subject.notes);
  const answerWords = normalizedAnswer.split(' ');
  const matches = noteWords.filter((word) => answerWords.includes(word)).length;
  const coverage = matches / Math.max(1, noteWords.length);
  const lengthFactor = answer.length >= 320 ? 1 : answer.length >= 180 ? 0.8 : 0.5;
  const rawScore = (coverage * 0.75 + lengthFactor * 0.25) * 10;
  const rounded = clamp(Math.round(rawScore), 1, 10);
  const missing = noteWords.filter((word) => !answerWords.includes(word)).slice(0, 4);
  const corrections = missing.length
    ? missing.map((word) => `Correzione: integra il concetto di "${word}" nel tuo svolgimento.`)
    : ['Nessuna correzione rilevata: l’argomento è stato trattato in modo completo.'];

  return { score: rounded, corrections };
};

const gradeOral = (subject: Subject, answer: string) => {
  const noteWords = buildKeywords(subject.notes);
  const answerWords = normalizeText(answer).split(' ');
  const matches = noteWords.filter((word) => answerWords.includes(word)).length;
  const coverage = matches / Math.max(1, noteWords.length);
  const lengthFactor = answer.length >= 220 ? 1 : answer.length >= 120 ? 0.7 : 0.4;
  const rawScore = (coverage * 0.7 + lengthFactor * 0.3) * 10;
  return clamp(Math.round(rawScore), 1, 10);
};

function App() {
  const [trimester, setTrimester] = useState('Trimestre 1');
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    if (typeof window === 'undefined') return initialSubjects;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return initialSubjects;

    try {
      const parsed = JSON.parse(saved) as { subjects?: Subject[]; trimester?: string; writtenResults?: WrittenResult[]; oralResults?: OralResult[] };
      return parsed.subjects ?? initialSubjects;
    } catch {
      return initialSubjects;
    }
  });
  const [writtenResults, setWrittenResults] = useState<WrittenResult[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    try {
      const parsed = JSON.parse(saved) as { writtenResults?: WrittenResult[] };
      return parsed.writtenResults ?? [];
    } catch {
      return [];
    }
  });
  const [oralResults, setOralResults] = useState<OralResult[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    try {
      const parsed = JSON.parse(saved) as { oralResults?: OralResult[] };
      return parsed.oralResults ?? [];
    } catch {
      return [];
    }
  });
  const [selectedSubjectId, setSelectedSubjectId] = useState(initialSubjects[0].id);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectNotes, setNewSubjectNotes] = useState('');
  const [writtenQuestion, setWrittenQuestion] = useState('');
  const [writtenAnswer, setWrittenAnswer] = useState('');
  const [writtenSheet, setWrittenSheet] = useState<WrittenSheet | null>(null);
  const [oralQuestion, setOralQuestion] = useState('');
  const [interviewTranscript, setInterviewTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);

  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) ?? subjects[0] ?? initialSubjects[0];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = {
      subjects,
      trimester,
      writtenResults,
      oralResults,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [subjects, trimester, writtenResults, oralResults]);

  useEffect(() => {
    if (subjects.length && !subjects.some((subject) => subject.id === selectedSubjectId)) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [subjects, selectedSubjectId]);

  useEffect(() => {
    if (!selectedSubject) return;
    const generated = writtenQuestion || generateWrittenQuestion(selectedSubject);
    setWrittenQuestion(generated);
  }, [selectedSubjectId]);

  const subjectReports: SubjectReport[] = useMemo(() => {
    return subjects.map((subject) => {
      const writtenGrades = writtenResults.filter((result) => result.subjectId === subject.id).map((result) => result.score);
      const oralGrades = oralResults.filter((result) => result.subjectId === subject.id).map((result) => result.score);
      const writtenAvg = average(writtenGrades);
      const oralAvg = average(oralGrades);
      const overall = average([...writtenGrades, ...oralGrades]);

      return {
        subject,
        writtenAvg,
        oralAvg,
        overall,
      };
    });
  }, [subjects, writtenResults, oralResults]);

  const overallAverage = useMemo(() => average(subjectReports.map((report) => report.overall)), [subjectReports]);

  const finalVerdict = useMemo(() => {
    if (!subjectReports.length) return { label: 'RIMANDATO', color: '#f59e0b' };
    const failedSubjects = subjectReports.filter((report) => report.overall < 5);
    if (overallAverage >= 6 && failedSubjects.length === 0) {
      return { label: 'PROMOSSO', color: '#10b981' };
    }
    if (overallAverage >= 5 && failedSubjects.length <= 1) {
      return { label: 'RIMANDATO', color: '#f59e0b' };
    }
    return { label: 'BOCCIATO', color: '#ef4444' };
  }, [overallAverage, subjectReports]);

  const addSubject = () => {
    const cleanName = newSubjectName.trim();
    if (!cleanName) return;

    const newSubject: Subject = {
      id: `${cleanName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      name: cleanName,
      notes: newSubjectNotes.trim() || 'Aggiungi qui gli appunti della materia e le nozioni chiave da studiare.',
      color: ['#8b5cf6', '#14b8a6', '#f59e0b', '#f43f5e', '#60a5fa'][subjects.length % 5],
    };
    setSubjects((current) => [...current, newSubject]);
    setSelectedSubjectId(newSubject.id);
    setNewSubjectName('');
    setNewSubjectNotes('');
  };

  const handleNotesUpdate = (subjectId: string, value: string) => {
    setSubjects((current) =>
      current.map((subject) =>
        subject.id === subjectId
          ? {
              ...subject,
              notes: value,
            }
          : subject,
      ),
    );
  };

  const handleWrittenGenerate = () => {
    if (!selectedSubject) return;
    setWrittenQuestion(generateWrittenQuestion(selectedSubject));
    setWrittenAnswer('');
    setWrittenSheet(null);
  };

  const handleWrittenSubmit = () => {
    if (!selectedSubject || !writtenAnswer.trim()) return;

    const { score, corrections } = gradeWritten(selectedSubject, writtenAnswer);
    const result: WrittenResult = {
      id: `written-${Date.now()}`,
      subjectId: selectedSubject.id,
      question: writtenQuestion,
      answer: writtenAnswer,
      score,
      corrections,
      date: new Date().toLocaleDateString('it-IT'),
    };

    setWrittenResults((current) => [result, ...current].slice(0, 10));
    setWrittenSheet({
      question: writtenQuestion,
      answer: writtenAnswer,
      score,
      corrections,
    });
    setWrittenAnswer('');
  };

  const handleOralQuestion = () => {
    if (!selectedSubject) return;
    const nextQuestion = generateWrittenQuestion(selectedSubject).replace('Spiega in modo chiaro e dettagliato', 'Rispondi oralmente e in modo sintetico a');
    setOralQuestion(nextQuestion);
    setInterviewTranscript('');

    if ('speechSynthesis' in window) {
      setIsSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(nextQuestion);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }

    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInterviewTranscript(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleOralSubmit = () => {
    if (!selectedSubject || !interviewTranscript.trim()) return;

    const score = gradeOral(selectedSubject, interviewTranscript);
    const result: OralResult = {
      id: `oral-${Date.now()}`,
      subjectId: selectedSubject.id,
      question: oralQuestion || generateWrittenQuestion(selectedSubject),
      answer: interviewTranscript,
      score,
      date: new Date().toLocaleDateString('it-IT'),
    };

    setOralResults((current) => [result, ...current].slice(0, 10));
    setInterviewTranscript('');
    setOralQuestion('');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-box">
          <span className="brand-badge">A</span>
          <div>
            <p className="eyebrow">Sistema universitario</p>
            <h1>Accademia Digitale</h1>
          </div>
        </div>

        <div className="card section-card">
          <h2>Trimestre</h2>
          <select value={trimester} onChange={(event) => setTrimester(event.target.value)}>
            <option value="Trimestre 1">Trimestre 1</option>
            <option value="Trimestre 2">Trimestre 2</option>
            <option value="Trimestre 3">Trimestre 3</option>
          </select>
        </div>

        <div className="card section-card">
          <h2>Materie</h2>
          <div className="subject-list">
            {subjects.map((subject) => (
              <button
                key={subject.id}
                className={`subject-pill ${selectedSubjectId === subject.id ? 'active' : ''}`}
                type="button"
                onClick={() => setSelectedSubjectId(subject.id)}
              >
                <span className="subject-dot" style={{ background: subject.color }} />
                {subject.name}
              </button>
            ))}
          </div>
        </div>

        <div className="card section-card">
          <h2>Aggiungi materia</h2>
          <input
            type="text"
            value={newSubjectName}
            placeholder="Nome della materia"
            onChange={(event) => setNewSubjectName(event.target.value)}
          />
          <textarea
            value={newSubjectNotes}
            placeholder="Inserisci appunti o contenuti da studiare"
            rows={5}
            onChange={(event) => setNewSubjectNotes(event.target.value)}
          />
          <button className="primary-button" type="button" onClick={addSubject}>
            Salva materia
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar card">
          <div>
            <p className="eyebrow">Riepilogo</p>
            <h2>{trimester}</h2>
          </div>
          <div className={`verdict-pill ${finalVerdict.label.toLowerCase()}`} style={{ borderColor: finalVerdict.color }}>
            {finalVerdict.label}
          </div>
        </header>

        <section className="card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Materia attiva</p>
              <h2>{selectedSubject.name}</h2>
            </div>
            <span className="section-tag" style={{ background: `${selectedSubject.color}22`, color: selectedSubject.color }}>
              Appunti digitali
            </span>
          </div>

          <div className="notes-panel">
            <label>Appunti e contenuti</label>
            <textarea
              value={selectedSubject.notes}
              rows={8}
              onChange={(event) => handleNotesUpdate(selectedSubject.id, event.target.value)}
            />
          </div>
        </section>

        <section className="content-grid">
          <div className="card panel-box">
            <div className="section-header small-gap">
              <div>
                <p className="eyebrow">Prova scritta</p>
                <h3>Compito a risposta aperta</h3>
              </div>
              <button className="secondary-button" type="button" onClick={handleWrittenGenerate}>
                Genera compito
              </button>
            </div>

            <div className="question-box">
              <strong>Domanda</strong>
              <p>{writtenQuestion || 'Genera un compito per iniziare.'}</p>
            </div>

            <textarea
              value={writtenAnswer}
              rows={7}
              placeholder="Scrivi la tua risposta in modo dettagliato..."
              onChange={(event) => setWrittenAnswer(event.target.value)}
            />

            <button className="primary-button" type="button" onClick={handleWrittenSubmit}>
              Consegna prova scritta
            </button>

            {writtenSheet && (
              <div className="sheet-wrapper">
                <div className="sheet-header">
                  <span>Voto finale: {writtenSheet.score}/10</span>
                  <span>{new Date().toLocaleDateString('it-IT')}</span>
                </div>

                <div className="paper-sheet">
                  <div className="question-title">Compito scritto</div>
                  <p>{writtenSheet.question}</p>
                  <div className="answer-block">
                    {writtenSheet.answer.split(/(\s+)/).map((chunk, index) => {
                      const isErrorWord = writtenSheet.corrections.some((correction) => correction.includes(chunk.trim()));
                      return (
                        <span key={`${chunk}-${index}`} className={isErrorWord ? 'red-pen-word' : ''}>
                          {chunk}
                        </span>
                      );
                    })}
                  </div>
                  <div className="annotation-block">
                    {writtenSheet.corrections.map((entry) => (
                      <div key={entry} className="annotation">
                        <span className="red-dot" />
                        {entry}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card panel-box">
            <div className="section-header small-gap">
              <div>
                <p className="eyebrow">Prova orale</p>
                <h3>Interrogazione vocale</h3>
              </div>
              <button className="secondary-button" type="button" onClick={handleOralQuestion}>
                {isSpeaking ? 'Ascolta…' : 'Avvia domanda'}
              </button>
            </div>

            <div className="oral-box">
              <strong>Domanda orale</strong>
              <p>{oralQuestion || 'Poni la domanda e ascolta la risposta.'}</p>
            </div>

            <div className="speech-controls">
              <button className="primary-button" type="button" onClick={() => recognitionRef.current?.start()} disabled={isListening}>
                {isListening ? 'Ascolto in corso...' : 'Avvia microfono'}
              </button>
            </div>

            <textarea
              value={interviewTranscript}
              rows={5}
              placeholder="La risposta dell’interrogazione comparirà qui..."
              readOnly
            />

            <button className="primary-button" type="button" onClick={handleOralSubmit} disabled={!interviewTranscript.trim()}>
              Salva voto orale
            </button>
          </div>
        </section>

        <section className="card report-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Pagella definitiva</p>
              <h2>Esito del trimestre</h2>
            </div>
            <div className="stamp" style={{ borderColor: finalVerdict.color, color: finalVerdict.color }}>
              {finalVerdict.label}
            </div>
          </div>

          <div className="report-grid">
            {subjectReports.map(({ subject, writtenAvg, oralAvg, overall }) => (
              <div key={subject.id} className="report-item">
                <div className="report-header">
                  <span className="subject-dot" style={{ background: subject.color }} />
                  <strong>{subject.name}</strong>
                </div>
                <div className="score-row">
                  <span>Scritta</span>
                  <strong>{writtenAvg ? writtenAvg.toFixed(1) : '—'}</strong>
                </div>
                <div className="score-row">
                  <span>Orale</span>
                  <strong>{oralAvg ? oralAvg.toFixed(1) : '—'}</strong>
                </div>
                <div className="score-row total-row">
                  <span>Media</span>
                  <strong>{overall ? overall.toFixed(1) : '—'}</strong>
                </div>
              </div>
            ))}
          </div>

          <div className="overall-summary">
            <div>
              <span>Media trimestrale</span>
              <strong>{overallAverage.toFixed(1)}/10</strong>
            </div>
            <div>
              <span>Verdetto ufficiale</span>
              <strong>{finalVerdict.label}</strong>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
