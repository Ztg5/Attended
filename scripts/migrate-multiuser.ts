/**
 * One-time single-user → multi-user migration. Assigns every existing (global) game
 * to the owner's account as an Attendance row, carrying the game's old personal note.
 *
 * Idempotent (safe to re-run) and reversible. Because notes move off the Game table,
 * this is a two-phase change around `prisma db push`:
 *
 *   1. npm run migrate:multiuser -- --backup                 # snapshot Game.notes → notes-backup.json
 *   2. npm run db:push                                       # creates auth + Attendance tables, drops Game.notes
 *   3. npm run migrate:multiuser -- --email you@gmail.com    # create owner + Attendance rows (notes from backup)
 *
 * Reverse:
 *   npm run migrate:multiuser -- --revert --email you@gmail.com   # remove the owner's Attendance rows
 *   (add --delete-user to also remove the owner User row)
 *   To restore the Game.notes column: re-add it to schema.prisma, db:push, then rerun
 *   with --restore-notes to copy notes-backup.json back onto the Game rows.
 *
 * The backup step reads Game.notes via raw SQL so it works whether or not the Prisma
 * client still knows about the column.
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/db";

const BACKUP_PATH = path.resolve(process.cwd(), "notes-backup.json");

const argv = process.argv.slice(2);
const has = (flag: string) => argv.includes(flag);
function argValue(name: string): string | null {
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
}

interface NoteRow {
  id: number;
  notes: string | null;
}

/** Snapshot Game.notes to notes-backup.json (raw SQL — column may be gone from the client). */
async function backup() {
  const rows = await prisma.$queryRawUnsafe<NoteRow[]>('SELECT id, notes FROM "Game"');
  fs.writeFileSync(BACKUP_PATH, JSON.stringify(rows, null, 2));
  const withNotes = rows.filter((r) => r.notes && r.notes.trim()).length;
  console.log(`Backed up ${rows.length} games (${withNotes} with notes) → ${BACKUP_PATH}`);
}

/** notes keyed by game id, preferring the backup file, falling back to a live read. */
async function loadNotes(): Promise<Map<number, string | null>> {
  if (fs.existsSync(BACKUP_PATH)) {
    const rows = JSON.parse(fs.readFileSync(BACKUP_PATH, "utf8")) as NoteRow[];
    console.log(`Using notes-backup.json (${rows.length} games).`);
    return new Map(rows.map((r) => [r.id, r.notes]));
  }
  try {
    const rows = await prisma.$queryRawUnsafe<NoteRow[]>('SELECT id, notes FROM "Game"');
    console.log(`No backup file — read notes live from Game (${rows.length} games).`);
    return new Map(rows.map((r) => [r.id, r.notes]));
  } catch {
    console.log("No backup file and Game.notes is gone — creating attendance without notes.");
    return new Map();
  }
}

function requireEmail(): string {
  const email = (argValue("--email") ?? process.env.OWNER_EMAIL ?? "").trim();
  if (!email) {
    console.error("Missing owner email. Pass --email you@gmail.com or set OWNER_EMAIL.");
    process.exit(1);
  }
  return email;
}

async function apply() {
  const email = requireEmail();
  const owner = await prisma.user.upsert({
    where: { email },
    create: { email },
    update: {},
    select: { id: true },
  });

  const notes = await loadNotes();
  const games = await prisma.game.findMany({ select: { id: true } });

  let created = 0;
  let updated = 0;
  for (const g of games) {
    const note = notes.get(g.id) ?? null;
    const existing = await prisma.attendance.findUnique({
      where: { userId_gameId: { userId: owner.id, gameId: g.id } },
      select: { id: true },
    });
    if (existing) {
      await prisma.attendance.update({ where: { id: existing.id }, data: { notes: note } });
      updated++;
    } else {
      await prisma.attendance.create({ data: { userId: owner.id, gameId: g.id, notes: note } });
      created++;
    }
  }
  console.log(`Owner <${email}> now attends ${games.length} games (created ${created}, updated ${updated}).`);
}

async function revert() {
  const email = requireEmail();
  const owner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!owner) {
    console.log(`No user <${email}> — nothing to revert.`);
    return;
  }
  const { count } = await prisma.attendance.deleteMany({ where: { userId: owner.id } });
  console.log(`Removed ${count} attendance rows for <${email}>.`);
  if (has("--delete-user")) {
    await prisma.user.delete({ where: { id: owner.id } });
    console.log(`Deleted user <${email}>.`);
  }
}

/** Copy notes-backup.json back onto Game.notes (requires the column to exist again). */
async function restoreNotes() {
  if (!fs.existsSync(BACKUP_PATH)) {
    console.error("No notes-backup.json to restore from.");
    process.exit(1);
  }
  const rows = JSON.parse(fs.readFileSync(BACKUP_PATH, "utf8")) as NoteRow[];
  let n = 0;
  for (const r of rows) {
    if (r.notes == null) continue;
    await prisma.$executeRawUnsafe('UPDATE "Game" SET notes = $1 WHERE id = $2', r.notes, r.id);
    n++;
  }
  console.log(`Restored notes onto ${n} Game rows.`);
}

async function main() {
  if (has("--backup")) await backup();
  else if (has("--revert")) await revert();
  else if (has("--restore-notes")) await restoreNotes();
  else await apply();
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("\nMigration failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
