'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast-provider';
import { formatFileSize } from '@/lib/utils';
import {
  FileText, Trash2, AlertCircle, CheckCircle, Loader2, File, CloudUpload,
} from 'lucide-react';
import type { KBDocument } from '@/types';

interface KnowledgeBaseManagerProps { botId: string; }

const statusConfig: Record<string, { label: string; variant: 'info' | 'warning' | 'success' | 'error'; icon: typeof Loader2 }> = {
  uploading: { label: 'Caricamento...', variant: 'info', icon: Loader2 },
  processing: { label: 'Elaborazione...', variant: 'warning', icon: Loader2 },
  indexed: { label: 'Indicizzato', variant: 'success', icon: CheckCircle },
  error: { label: 'Errore', variant: 'error', icon: AlertCircle },
};

// Load mammoth.js from CDN for client-side DOCX parsing
function loadMammoth(): Promise<typeof window.mammoth> {
  return new Promise((resolve, reject) => {
    if ((window as any).mammoth) { resolve((window as any).mammoth); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js';
    script.onload = () => resolve((window as any).mammoth);
    script.onerror = () => reject(new Error('Failed to load mammoth.js'));
    document.head.appendChild(script);
  });
}

// Load pdf.js from CDN for client-side PDF parsing
function loadPdfJs(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) { resolve((window as any).pdfjsLib); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(lib);
    };
    script.onerror = () => reject(new Error('Failed to load pdf.js'));
    document.head.appendChild(script);
  });
}

async function extractText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  if (file.name.endsWith('.docx')) {
    const mammoth = await loadMammoth();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } else if (file.name.endsWith('.pdf')) {
    const pdfjsLib = await loadPdfJs();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item: any) => item.str).join(' '));
    }
    return pages.join('\n');
  }
  throw new Error('Unsupported file type');
}

export function KnowledgeBaseManager({ botId }: KnowledgeBaseManagerProps) {
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { notify } = useToast();

  useEffect(() => { fetchDocuments(); }, [botId]);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/documents?botId=' + botId);
      if (res.ok) { const data = await res.json(); setDocuments(data.documents ?? []); }
    } catch {} finally { setIsLoading(false); }
  };

  const processEmbeddings = useCallback(async (docId: string) => {
    let done = false;
    while (!done) {
      try {
        const res = await fetch('/api/embeddings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: docId }),
        });
        const data = await res.json();
        if (!res.ok) {
          setProgress(p => ({ ...p, [docId]: 'Errore: ' + (data.error || 'sconosciuto') }));
          setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status: 'error' as const } : d));
          return;
        }
        done = data.done;
        const tot = data.total || 0;
        const rem = data.remaining || 0;
        setProgress(p => ({ ...p, [docId]: done ? 'Completato!' : 'Embedding ' + (tot - rem) + '/' + tot }));
        if (done) {
          setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status: 'indexed' as const, chunkCount: tot } : d));
          notify({ type: 'success', title: 'Indicizzazione completata', message: tot + ' chunks indicizzati.' });
          setTimeout(() => setProgress(p => { const n = { ...p }; delete n[docId]; return n; }), 3000);
        }
      } catch { setProgress(p => ({ ...p, [docId]: 'Errore di rete' })); return; }
    }
  }, [notify]);

  const uploadFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.pdf') && !file.name.endsWith('.docx')) {
      notify({ type: 'error', title: 'Formato non supportato', message: 'Solo PDF o DOCX.' }); return;
    }
    if (file.size > 20 * 1024 * 1024) {
      notify({ type: 'error', title: 'File troppo grande', message: 'Max 20 MB.' }); return;
    }

    setIsUploading(true);
    try {
      // Extract text client-side
      setProgress(p => ({ ...p, uploading: 'Estrazione testo...' }));
      const text = await extractText(file);
      if (!text || text.trim().length < 10) {
        notify({ type: 'error', title: 'Nessun testo trovato', message: 'Il documento sembra vuoto.' }); return;
      }
      setProgress(p => ({ ...p, uploading: 'Salvataggio...' }));

      // Send extracted text to server
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId, fileName: file.name, fileSize: file.size,
          fileType: file.name.endsWith('.pdf') ? 'pdf' : 'docx', text,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setDocuments(prev => [data.document, ...prev]);
      setProgress(p => { const n = { ...p }; delete n.uploading; return n; });
      notify({ type: 'success', title: 'Testo estratto', message: data.document.chunkCount + ' chunks — avvio embedding...' });

      if (data.needsEmbeddings) {
        setProgress(p => ({ ...p, [data.document.id]: 'Avvio embedding...' }));
        processEmbeddings(data.document.id);
      }
    } catch (err) {
      notify({ type: 'error', title: 'Errore', message: err instanceof Error ? err.message : 'Upload fallito' });
    } finally {
      setIsUploading(false);
      setProgress(p => { const n = { ...p }; delete n.uploading; return n; });
    }
  }, [botId, notify, processEmbeddings]);

  const deleteDoc = async (doc: KBDocument) => {
    try {
      const res = await fetch('/api/documents', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: doc.id, storagePath: doc.storagePath }),
      });
      if (!res.ok) throw new Error('Delete failed');
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      notify({ type: 'info', title: 'Rimosso', message: doc.fileName });
    } catch { notify({ type: 'error', title: 'Errore', message: 'Impossibile eliminare.' }); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Card padding="none">
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) uploadFile(f); }}
          onClick={() => fileInputRef.current?.click()}
          className={'p-10 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 text-center m-1 ' + (isDragging ? 'border-brand-400 bg-brand-50' : 'border-surface-200 hover:border-brand-300 hover:bg-surface-50')}
        >
          <div className={'w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ' + (isDragging ? 'bg-brand-100' : 'bg-surface-100')}>
            <CloudUpload className={'w-7 h-7 ' + (isDragging ? 'text-brand-500' : 'text-surface-400')} />
          </div>
          <div>
            <p className="font-semibold text-surface-800">{isUploading ? (progress.uploading || 'Elaborazione...') : 'Trascina un file qui'}</p>
            <p className="text-sm text-surface-500 mt-1">oppure clicca per selezionare — PDF o DOCX, max 20 MB</p>
          </div>
          {isUploading && <Loader2 className="w-5 h-5 animate-spin text-brand-500" />}
          <input ref={fileInputRef} type="file" accept=".pdf,.docx" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ''; }} />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle><span className="flex items-center gap-2"><FileText className="w-5 h-5 text-brand-500" />Documenti ({documents.length})</span></CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchDocuments}>Aggiorna</Button>
        </CardHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-surface-400" /></div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12 text-surface-400">
            <File className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nessun documento</p>
            <p className="text-sm mt-1">Carica file PDF o DOCX per creare la knowledge base.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map(doc => {
              const st = statusConfig[doc.status] ?? statusConfig.error;
              const Icon = st.icon;
              const prog = progress[doc.id];
              return (
                <div key={doc.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-50 hover:bg-surface-100 transition-colors group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-brand-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-surface-800 truncate">{doc.fileName}</p>
                      <p className="text-xs text-surface-400">
                        {formatFileSize(doc.fileSize)}
                        {doc.chunkCount ? ' - ' + doc.chunkCount + ' chunks' : ''}
                        {prog ? ' - ' + prog : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={st.variant}>
                      <Icon className={'w-3 h-3 mr-1 ' + (doc.status === 'processing' ? 'animate-spin' : '')} />
                      {st.label}
                    </Badge>
                    <button onClick={() => deleteDoc(doc)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-50 text-surface-400 hover:text-rose-500 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
