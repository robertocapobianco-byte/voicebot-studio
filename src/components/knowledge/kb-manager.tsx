'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast-provider';
import { formatFileSize, formatDate } from '@/lib/utils';
import {
  Upload, FileText, Trash2, AlertCircle, CheckCircle, Loader2, File, CloudUpload,
} from 'lucide-react';
import type { KBDocument } from '@/types';

interface KnowledgeBaseManagerProps {
  botId: string;
}

const statusConfig: Record<string, { label: string; variant: 'info' | 'warning' | 'success' | 'error'; icon: typeof Loader2 }> = {
  uploading: { label: 'Caricamento...', variant: 'info', icon: Loader2 },
  processing: { label: 'Elaborazione...', variant: 'warning', icon: Loader2 },
  indexed: { label: 'Indicizzato', variant: 'success', icon: CheckCircle },
  error: { label: 'Errore', variant: 'error', icon: AlertCircle },
};

export function KnowledgeBaseManager({ botId }: KnowledgeBaseManagerProps) {
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [embeddingProgress, setEmbeddingProgress] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { notify } = useToast();

  useEffect(() => { fetchDocuments(); }, [botId]);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/documents?botId=' + botId);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents ?? []);
      }
    } catch { /* silent */ } finally { setIsLoading(false); }
  };

  // Process embeddings in batches via polling
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
          setEmbeddingProgress((prev) => ({ ...prev, [docId]: 'Errore: ' + (data.error || 'sconosciuto') }));
          setDocuments((prev) => prev.map((d) => d.id === docId ? { ...d, status: 'error' as const } : d));
          return;
        }
        done = data.done;
        const total = data.total || 0;
        const remaining = data.remaining || 0;
        const processed = total - remaining;
        setEmbeddingProgress((prev) => ({
          ...prev,
          [docId]: done ? 'Completato!' : 'Embedding: ' + processed + '/' + total + ' chunks',
        }));
        if (done) {
          setDocuments((prev) => prev.map((d) =>
            d.id === docId ? { ...d, status: 'indexed' as const, chunkCount: total } : d
          ));
          notify({ type: 'success', title: 'Indicizzazione completata', message: total + ' chunks indicizzati.' });
          setEmbeddingProgress((prev) => { const n = { ...prev }; delete n[docId]; return n; });
        }
      } catch (err) {
        setEmbeddingProgress((prev) => ({ ...prev, [docId]: 'Errore di rete' }));
        return;
      }
    }
  }, [notify]);

  const uploadFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.pdf') && !file.name.endsWith('.docx')) {
      notify({ type: 'error', title: 'Formato non supportato', message: 'Carica solo file PDF o DOCX.' });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      notify({ type: 'error', title: 'File troppo grande', message: 'Il limite è 20 MB.' });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('botId', botId);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setDocuments((prev) => [data.document, ...prev]);
      notify({ type: 'success', title: 'File caricato', message: file.name + ' â avvio indicizzazione...' });

      // Start embedding processing
      if (data.needsEmbeddings) {
        setEmbeddingProgress((prev) => ({ ...prev, [data.document.id]: 'Avvio embedding...' }));
        processEmbeddings(data.document.id);
      }
    } catch (err) {
      notify({ type: 'error', title: 'Errore caricamento', message: err instanceof Error ? err.message : 'Errore sconosciuto' });
    } finally {
      setIsUploading(false);
    }
  }, [botId, notify, processEmbeddings]);

  const deleteDoc = async (doc: KBDocument) => {
    try {
      const res = await fetch('/api/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: doc.id, storagePath: doc.storagePath }),
      });
      if (!res.ok) throw new Error('Errore eliminazione');
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      notify({ type: 'info', title: 'Documento rimosso', message: doc.fileName });
    } catch {
      notify({ type: 'error', title: 'Errore', message: 'Impossibile eliminare il documento.' });
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) uploadFile(file); };

  return (
    <div className="space-y-6 animate-fade-in">
      <Card padding="none">
        <div
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={'p-10 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 text-center m-1 ' + (isDragging ? 'border-brand-400 bg-brand-50' : 'border-surface-200 hover:border-brand-300 hover:bg-surface-50')}
        >
          <div className={'w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ' + (isDragging ? 'bg-brand-100' : 'bg-surface-100')}>
            <CloudUpload className={'w-7 h-7 ' + (isDragging ? 'text-brand-500' : 'text-surface-400')} />
          </div>
          <div>
            <p className="font-semibold text-surface-800">{isUploading ? 'Caricamento in corso...' : 'Trascina un file qui'}</p>
            <p className="text-sm text-surface-500 mt-1">oppure clicca per selezionare â PDF o DOCX, max 20 MB</p>
          </div>
          {isUploading && <Loader2 className="w-5 h-5 animate-spin text-brand-500" />}
          <input ref={fileInputRef} type="file" accept=".pdf,.docx" className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadFile(file); e.target.value = ''; }} />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-500" />
              Documenti ({documents.length})
            </span>
          </CardTitle>
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
            {documents.map((doc) => {
              const status = statusConfig[doc.status] ?? statusConfig.error;
              const StatusIcon = status.icon;
              const progress = embeddingProgress[doc.id];
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
                        {doc.chunkCount ? ' â ' + doc.chunkCount + ' chunks' : ''}
                        {progress ? ' â ' + progress : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={status.variant}>
                      <StatusIcon className={'w-3 h-3 mr-1 ' + (doc.status === 'processing' || doc.status === 'uploading' ? 'animate-spin' : '')} />
                      {status.label}
                    </Badge>
                    <button onClick={() => deleteDoc(doc)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-50 text-surface-400 hover:text-rose-500 transition-all"
                      title="Elimina documento">
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
