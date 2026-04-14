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

const statusConfig: Record<string, any> = {
  uploading:   { label: 'Caricamento...', variant: 'info',    icon: Loader2 },
  processing:  { label: 'Elaborazione...', variant: 'warning', icon: Loader2 },
  indexed:     { label: 'Indicizzato',    variant: 'success', icon: CheckCircle },
  error:       { label: 'Errore',         variant: 'error',   icon: AlertCircle },
};

/* ââ Client-side CDN loaders ââ */

function loadMammoth(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).mammoth) { resolve((window as any).mammoth); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js';
    s.onload = () => resolve((window as any).mammoth);
    s.onerror = () => reject(new Error('Failed to load mammoth.js'));
    document.head.appendChild(s);
  });
}

function loadPdfJs(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) { resolve((window as any).pdfjsLib); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      const lib = (window as any).pdfjsLib;
      lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(lib);
    };
    s.onerror = () => reject(new Error('Failed to load pdf.js'));
    document.head.appendChild(s);
  });
}

/* ââ Client-side text extraction ââ */

async function extractText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  if (file.name.endsWith('.docx')) {
    const mammoth = await loadMammoth();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  if (file.name.endsWith('.pdf')) {
    const pdfjsLib = await loadPdfJs();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item: any) => item.str).join(' '));
    }
    return pages.join('\n');
  }

  // Plain text fallback
  return new TextDecoder().decode(arrayBuffer);
}

/* ââ Client-side chunking ââ */

function chunkText(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 1000) return cleaned.length > 50 ? [cleaned] : [];

  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    let end = Math.min(start + 1000, cleaned.length);
    if (end < cleaned.length) {
      const bp = Math.max(
        cleaned.lastIndexOf('. ', end),
        cleaned.lastIndexOf('\n', end)
      );
      if (bp > start + 500) end = bp + 1;
    }
    const chunk = cleaned.slice(start, end).trim();
    if (chunk.length > 50) chunks.push(chunk);
    start = end - 200;
    if (start >= cleaned.length) break;
  }
  return chunks;
}

/* ââ Component ââ */

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

  /* ââ Embeddings (batched, called after all chunks saved) ââ */

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
        setProgress(p => ({
          ...p,
          [docId]: done ? 'Completato!' : 'Embedding ' + (tot - rem) + '/' + tot,
        }));
        if (done) {
          setDocuments(prev =>
            prev.map(d => d.id === docId ? { ...d, status: 'indexed' as const, chunkCount: tot } : d)
          );
          notify({ type: 'success', title: 'Indicizzazione completata', message: tot + ' chunks indicizzati.' });
          setTimeout(() => setProgress(p => { const n = { ...p }; delete n[docId]; return n; }), 3000);
        }
      } catch {
        setProgress(p => ({ ...p, [docId]: 'Errore di rete' }));
        return;
      }
    }
  }, [notify]);

  /* ââ Upload: extract â chunk client-side â send batches of 20 ââ */

  const uploadFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.pdf') && !file.name.endsWith('.docx') && !file.name.endsWith('.txt')) {
      notify({ type: 'error', title: 'Formato non supportato', message: 'Solo PDF, DOCX o TXT.' });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      notify({ type: 'error', title: 'File troppo grande', message: 'Max 20 MB.' });
      return;
    }

    setIsUploading(true);
    try {
      // 1. Extract text client-side
      setProgress(p => ({ ...p, uploading: 'Estrazione testo...' }));
      const text = await extractText(file);
      if (!text || text.trim().length < 10) {
        notify({ type: 'error', title: 'Nessun testo trovato', message: 'Il documento sembra vuoto.' });
        return;
      }

      // 2. Chunk client-side
      setProgress(p => ({ ...p, uploading: 'Suddivisione in chunks...' }));
      const allChunks = chunkText(text);
      if (allChunks.length === 0) {
        notify({ type: 'error', title: 'Nessun contenuto utile', message: 'Testo troppo corto.' });
        return;
      }

      // 3. Send chunks in batches of 20 to avoid OOM on server
      const BATCH_SIZE = 20;
      let documentId: string | null = null;
      let offset = 0;

      for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
        const batch = allChunks.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(allChunks.length / BATCH_SIZE);

        setProgress(p => ({
          ...p,
          uploading: 'Salvataggio batch ' + batchNum + '/' + totalBatches + ' (' + allChunks.length + ' chunks)',
        }));

        const payload: any = {
          botId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.name.endsWith('.pdf') ? 'pdf' : file.name.endsWith('.docx') ? 'docx' : 'txt',
          chunks: batch,
          chunkOffset: offset,
        };

        if (documentId) {
          payload.documentId = documentId;
        }

        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload batch failed');

        documentId = data.documentId;
        offset = data.chunkOffset;
      }

      // 4. Update document status
      if (documentId) {
        await fetch('/api/documents/finalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId, chunkCount: allChunks.length }),
        });

        const newDoc: KBDocument = {
          id: documentId,
          botId,
          fileName: file.name,
          fileType: file.name.endsWith('.pdf') ? 'pdf' : 'docx',
          fileSize: file.size,
          status: 'processing',
          storagePath: '',
          chunkCount: allChunks.length,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setDocuments(prev => [newDoc, ...prev]);
        setProgress(p => { const n = { ...p }; delete n.uploading; return n; });
        notify({
          type: 'success',
          title: 'Testo estratto',
          message: allChunks.length + ' chunks â avvio embedding...',
        });

        // 5. Start embeddings
        setProgress(p => ({ ...p, [documentId!]: 'Avvio embedding...' }));
        processEmbeddings(documentId);
      }
    } catch (err) {
      notify({
        type: 'error',
        title: 'Errore',
        message: err instanceof Error ? err.message : 'Upload fallito',
      });
    } finally {
      setIsUploading(false);
      setProgress(p => { const n = { ...p }; delete n.uploading; return n; });
    }
  }, [botId, notify, processEmbeddings]);

  /* ââ Delete ââ */

  const deleteDoc = async (doc: KBDocument) => {
    try {
      const res = await fetch('/api/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: doc.id, storagePath: doc.storagePath }),
      });
      if (!res.ok) throw new Error('Delete failed');
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      notify({ type: 'info', title: 'Rimosso', message: doc.fileName });
    } catch {
      notify({ type: 'error', title: 'Errore', message: 'Impossibile eliminare.' });
    }
  };

  /* ââ Render ââ */

  return (
    <div className="space-y-6">
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) uploadFile(f);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={
          'p-10 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 ' +
          'flex flex-col items-center justify-center gap-3 text-center m-1 ' +
          (isDragging ? 'border-brand-400 bg-brand-50' : 'border-surface-200 hover:border-brand-300 hover:bg-surface-50')
        }
      >
        <CloudUpload className="w-10 h-10 text-surface-400" />
        <p className="font-medium text-surface-700">
          {isUploading ? (progress.uploading || 'Elaborazione...') : 'Trascina un file qui'}
        </p>
        <p className="text-sm text-surface-400">oppure clicca per selezionare â PDF, DOCX o TXT, max 20 MB</p>
        {isUploading && <Loader2 className="w-5 h-5 animate-spin text-brand-500" />}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) uploadFile(f);
            e.target.value = '';
          }}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Documenti ({documents.length})</CardTitle>
        </CardHeader>
        <div className="px-6 pb-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-surface-400" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-surface-300 mx-auto mb-3" />
              <p className="text-surface-500 font-medium">Nessun documento</p>
              <p className="text-sm text-surface-400">Carica file PDF o DOCX per creare la knowledge base.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map(doc => {
                const st = statusConfig[doc.status] ?? statusConfig.error;
                const Icon = st.icon;
                const prog = progress[doc.id];
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-surface-50 border border-surface-100"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <File className="w-5 h-5 text-surface-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{doc.fileName}</p>
                        <p className="text-xs text-surface-400">
                          {formatFileSize(doc.fileSize)}
                          {doc.chunkCount ? ' â ' + doc.chunkCount + ' chunks' : ''}
                          {prog ? ' â ' + prog : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={st.variant as any} className="flex items-center gap-1">
                        <Icon className={'w-3 h-3' + (st.icon === Loader2 ? ' animate-spin' : '')} />
                        {st.label}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); deleteDoc(doc); }}
                      >
                        <Trash2 className="w-4 h-4 text-surface-400" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
