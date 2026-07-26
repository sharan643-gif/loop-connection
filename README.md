# loop-connection

## Feature: Real file & image attachments

The paperclip button in a chat (`chat-attachment-btn`) is now wired up.
Clicking it opens a native file picker; the chosen file is uploaded and
sent as a message, with the typed text (if any) attached as a caption.

**How it works**
- `DBAdapter.uploadAttachment(file)` uploads to a Supabase Storage bucket
  called `chat-attachments` when a cloud connection is active, or falls
  back to embedding the file as a base64 data URL in local-storage mode
  (capped at 1.5MB per file in that mode, since it shares localStorage's
  ~5MB quota with the rest of the app's data).
- Messages gained three optional fields: `attachmentUrl`, `attachmentType`
  (`"image"` or `"file"`), and `attachmentName`.
- Images render as an inline preview in the bubble; everything else
  renders as a small downloadable file chip.

**Supabase setup required for cloud mode**

1. Storage → create a new bucket named `chat-attachments`. Mark it
   **Public** (or add a policy granting `select` to `anon`/`authenticated`)
   so the stored `getPublicUrl()` links resolve for both people in the chat.
2. Add three columns to the `messages` table:
   ```sql
   alter table messages
     add column attachment_url text,
     add column attachment_type text,
     add column attachment_name text;
   ```
3. Add a Storage policy allowing authenticated (or anon, matching however
   your `profiles`/`messages` policies are set up) uploads/inserts into
   `chat-attachments`, e.g.:
   ```sql
   create policy "Allow uploads to chat-attachments"
     on storage.objects for insert
     with check (bucket_id = 'chat-attachments');
   create policy "Allow public read of chat-attachments"
     on storage.objects for select
     using (bucket_id = 'chat-attachments');
   ```

No changes are needed to run in local-storage mode — it works out of the box.

For the full setup script (columns + storage policies), see `setup_attachments.sql`.

## Feature: Real voice messages

The mic button (`chat-voice-btn`) now records real audio instead of
playing a mock sound.

**How it works**
- Tap the mic to start recording (`MediaRecorder`, requests mic permission
  the first time). The button turns red and pulses, a live timer appears,
  and a ✕ button shows up to discard the recording instead of sending it.
- Tap the mic again to stop — the clip uploads via the same
  `DBAdapter.uploadAttachment()` path as file attachments (same
  `chat-attachments` bucket, or the local-storage/base64 fallback), then
  sends as a message with `attachmentType: "audio"`.
- Voice notes render as a playback bar: a play/pause button, a waveform
  (cosmetic — bars are deterministically generated per message, not real
  amplitude data, since decoding true waveform data would need Web Audio
  analysis) with a progress overlay, and a duration label. Playback uses
  one shared `<audio>` element, so starting a new voice note pauses
  whichever one was already playing.

**Additional Supabase setup for cloud mode**

Voice notes reuse the same `chat-attachments` bucket and policies as file
attachments — no new bucket needed. They do need one more column, already
included in the updated `setup_attachments.sql`:
```sql
alter table messages
  add column if not exists attachment_duration integer;
```