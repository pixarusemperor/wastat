import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import Database from "better-sqlite3";
import type BetterSqlite3 from "better-sqlite3";
import { createStorageFromEnv, type StorageProvider } from "./media.js";
import { createDatabaseClient, type DbClient } from "./db/client.js";

// ==========================================
// Environment Loader
// ==========================================
export function loadEnv() {
  const envPaths = [join(process.cwd(), ".env"), join(process.cwd(), "..", "..", ".env")];
  for (const p of envPaths) {
    if (existsSync(p)) {
      const content = readFileSync(p, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  }
}

// ==========================================
// 1. PNG Generator (800x600 Standalone Image)
// ==========================================
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : (c >>> 1);
  }
  CRC_TABLE[i] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makePngChunk(type: string, data: Buffer): Buffer {
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, "ascii");
  if (len > 0) data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

export function generatePngImage(width = 800, height = 600): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8-bit per channel
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10); // Deflate
  ihdr.writeUInt8(0, 11); // Filter method 0
  ihdr.writeUInt8(0, 12); // No interlace

  const ihdrChunk = makePngChunk("IHDR", ihdr);

  // Scanline data (filter byte 0 + RGBA for each row)
  const rawSize = height * (1 + width * 4);
  const raw = Buffer.alloc(rawSize);

  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 255;

      if (y < 340) {
        // Sunset sky gradient
        const t = y / 340;
        // Deep royal purple dusk (40, 20, 70) to vibrant amber (255, 140, 50) to golden horizon (255, 210, 90)
        if (t < 0.6) {
          const k = t / 0.6;
          r = Math.round(40 + (255 - 40) * k);
          g = Math.round(20 + (140 - 20) * k);
          b = Math.round(70 + (50 - 70) * k);
        } else {
          const k = (t - 0.6) / 0.4;
          r = 255;
          g = Math.round(140 + (210 - 140) * k);
          b = Math.round(50 + (90 - 50) * k);
        }

        // Glowing Sun Disk
        const dx = x - 400;
        const dy = y - 240;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 45) {
          const glow = 1 - dist / 45;
          r = 255;
          g = Math.min(255, Math.round(g + 60 * glow));
          b = Math.min(255, Math.round(b + 120 * glow));
        }
      } else {
        // Luxury infinity pool & ocean reflection
        const t = (y - 340) / (height - 340);
        // Horizon deep turquoise (15, 75, 110) to azure pool depth (10, 140, 165)
        r = Math.round(15 + (10 - 15) * t);
        g = Math.round(75 + (140 - 75) * t);
        b = Math.round(110 + (165 - 110) * t);

        // Water ripple highlights
        const wave = Math.sin(x * 0.05 + y * 0.2);
        if (wave > 0.7) {
          r = Math.min(255, r + 25);
          g = Math.min(255, g + 35);
          b = Math.min(255, b + 45);
        }
      }

      // Luxury Villa silhouette & structure
      // Main villa pavilion: x between 140 and 660, y between 230 and 420
      if (x >= 140 && x <= 660 && y >= 230 && y <= 420) {
        // Villa roof canopy
        if (y >= 230 && y <= 250) {
          r = 25; g = 28; b = 32; // Sleek modern dark obsidian roof
        } else if (y >= 250 && y <= 380) {
          // Warm illuminated glass walls & villa interior
          if ((x >= 170 && x <= 320) || (x >= 360 && x <= 630)) {
            const isColumn = (x >= 320 && x <= 360) || (x >= 490 && x <= 505);
            if (isColumn) {
              r = 30; g = 32; b = 36;
            } else {
              // Warm golden interior illumination
              r = 250; g = 215; b = 130;
            }
          } else {
            r = 25; g = 28; b = 32;
          }
        } else if (y > 380) {
          // Pool deck edge
          r = 45; g = 48; b = 52;
        }
      }

      // Tropical Palm Silhouettes
      const leftPalmTrunk = Math.abs(x - (60 + (y - 100) * 0.15)) < 6 && y > 120 && y < 450;
      const rightPalmTrunk = Math.abs(x - (740 - (y - 100) * 0.12)) < 6 && y > 140 && y < 460;
      if (leftPalmTrunk || rightPalmTrunk) {
        r = 20; g = 22; b = 25;
      }

      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = a;
    }
  }

  const compressed = deflateSync(raw, { level: 9 });
  const idatChunk = makePngChunk("IDAT", compressed);
  const iendChunk = makePngChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// ==========================================
// 2. Audio Generator (Valid Standalone Audio)
// ==========================================

// Ogg CRC-32 table
const OGG_CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let r = i << 24;
  for (let j = 0; j < 8; j++) {
    r = (r & 0x80000000) !== 0 ? ((r << 1) ^ 0x04c11db7) >>> 0 : (r << 1) >>> 0;
  }
  OGG_CRC_TABLE[i] = r >>> 0;
}

function computeOggCrc(page: Buffer): number {
  let crc = 0;
  for (let i = 0; i < page.length; i++) {
    crc = ((crc << 8) ^ OGG_CRC_TABLE[((crc >>> 24) ^ page[i]) & 0xff]) >>> 0;
  }
  return crc;
}

function makeOggPage(
  headerType: number,
  granulePos: bigint,
  serial: number,
  seq: number,
  packets: Buffer[],
): Buffer {
  const segmentTable: number[] = [];
  const payloadBuffers: Buffer[] = [];

  for (const pkt of packets) {
    let remaining = pkt.length;
    let offset = 0;
    while (remaining >= 255) {
      segmentTable.push(255);
      payloadBuffers.push(pkt.subarray(offset, offset + 255));
      offset += 255;
      remaining -= 255;
    }
    segmentTable.push(remaining);
    if (remaining > 0) {
      payloadBuffers.push(pkt.subarray(offset, offset + remaining));
    }
  }

  const headerLen = 27 + segmentTable.length;
  const payloadLen = payloadBuffers.reduce((sum, b) => sum + b.length, 0);
  const page = Buffer.alloc(headerLen + payloadLen);

  page.write("OggS", 0, 4, "ascii");
  page.writeUInt8(0, 4); // Version 0
  page.writeUInt8(headerType, 5); // Flags (0x02 = BOS, 0x04 = EOS)
  page.writeBigUInt64LE(granulePos, 6);
  page.writeUInt32LE(serial, 14);
  page.writeUInt32LE(seq, 18);
  page.writeUInt32LE(0, 22); // Checksum placeholder
  page.writeUInt8(segmentTable.length, 26);

  for (let i = 0; i < segmentTable.length; i++) {
    page.writeUInt8(segmentTable[i], 27 + i);
  }

  let pOffset = headerLen;
  for (const buf of payloadBuffers) {
    buf.copy(page, pOffset);
    pOffset += buf.length;
  }

  const crc = computeOggCrc(page);
  page.writeUInt32LE(crc, 22);
  return page;
}

export function generateOggAudio(): Buffer {
  const serial = 0x5a464152; // "ZFAR"
  const pages: Buffer[] = [];

  // 1. OpusHead packet (19 bytes)
  const opusHead = Buffer.alloc(19);
  opusHead.write("OpusHead", 0, 8, "ascii");
  opusHead.writeUInt8(1, 8); // Version 1
  opusHead.writeUInt8(2, 9); // 2 channels (stereo)
  opusHead.writeUInt16LE(312, 10); // Pre-skip
  opusHead.writeUInt32LE(48000, 12); // 48000 Hz input sample rate
  opusHead.writeInt16LE(0, 16); // Output gain 0 dB
  opusHead.writeUInt8(0, 18); // Channel mapping 0

  pages.push(makeOggPage(0x02, 0n, serial, 0, [opusHead]));

  // 2. OpusTags packet
  const vendor = "WaStat Safari Audio Engine";
  const vendorBuf = Buffer.from(vendor, "utf8");
  const comment = "TITLE=Safari VIP Luxury Concierge Audio";
  const commentBuf = Buffer.from(comment, "utf8");

  const opusTags = Buffer.alloc(8 + 4 + vendorBuf.length + 4 + 4 + commentBuf.length);
  let tagOff = 0;
  opusTags.write("OpusTags", tagOff, 8, "ascii"); tagOff += 8;
  opusTags.writeUInt32LE(vendorBuf.length, tagOff); tagOff += 4;
  vendorBuf.copy(opusTags, tagOff); tagOff += vendorBuf.length;
  opusTags.writeUInt32LE(1, tagOff); tagOff += 4; // 1 comment
  opusTags.writeUInt32LE(commentBuf.length, tagOff); tagOff += 4;
  commentBuf.copy(opusTags, tagOff);

  pages.push(makeOggPage(0x00, 0n, serial, 1, [opusTags]));

  // 3. Audio packets (100 packets * 20ms = 2.0s of stereo audio)
  const totalPackets = 100;
  let currentGranule = 312n;

  for (let i = 0; i < totalPackets; i++) {
    currentGranule += 960n;
    const isLast = i === totalPackets - 1;

    const packet = Buffer.alloc(40);
    packet[0] = 0xfc;
    const t = i / totalPackets;
    const chimeFreq = Math.sin(i * 0.3) * Math.exp(-t * 2);
    packet[1] = Math.round(128 + 60 * chimeFreq) & 0xff;
    for (let j = 2; j < packet.length; j++) {
      packet[j] = (packet[j - 1] * 33 + i + j) & 0xff;
    }

    const flags = isLast ? 0x04 : 0x00;
    pages.push(makeOggPage(flags, currentGranule, serial, 2 + i, [packet]));
  }

  return Buffer.concat(pages);
}

export function generateMp3Audio(): Buffer {
  // ID3v2.3 Tag Header
  const title = "Safari Luxury Concierge Welcome";
  const artist = "Safari Host VIP";
  const titleBuf = Buffer.from(title, "utf8");
  const artistBuf = Buffer.from(artist, "utf8");

  // TIT2 frame
  const tit2Frame = Buffer.alloc(10 + 1 + titleBuf.length);
  tit2Frame.write("TIT2", 0, 4, "ascii");
  tit2Frame.writeUInt32BE(1 + titleBuf.length, 4);
  tit2Frame.writeUInt16BE(0, 8);
  tit2Frame.writeUInt8(0, 10);
  titleBuf.copy(tit2Frame, 11);

  // TPE1 frame
  const tpe1Frame = Buffer.alloc(10 + 1 + artistBuf.length);
  tpe1Frame.write("TPE1", 0, 4, "ascii");
  tpe1Frame.writeUInt32BE(1 + artistBuf.length, 4);
  tpe1Frame.writeUInt16BE(0, 8);
  tpe1Frame.writeUInt8(0, 10);
  artistBuf.copy(tpe1Frame, 11);

  const id3Body = Buffer.concat([tit2Frame, tpe1Frame]);
  const id3Header = Buffer.alloc(10);
  id3Header.write("ID3", 0, 3, "ascii");
  id3Header.writeUInt8(3, 3);
  id3Header.writeUInt8(0, 4);
  id3Header.writeUInt8(0, 5);
  const sz = id3Body.length;
  id3Header.writeUInt8((sz >> 21) & 0x7f, 6);
  id3Header.writeUInt8((sz >> 14) & 0x7f, 7);
  id3Header.writeUInt8((sz >> 7) & 0x7f, 8);
  id3Header.writeUInt8(sz & 0x7f, 9);

  // MPEG-1 Layer 3 Audio Frames (128 kbps, 44.1 kHz, Stereo = 417 bytes/frame)
  const frameCount = 100;
  const frameLen = 417;
  const frames: Buffer[] = [];

  for (let f = 0; f < frameCount; f++) {
    const frame = Buffer.alloc(frameLen);
    frame[0] = 0xff;
    frame[1] = 0xfb;
    frame[2] = 0x90;
    frame[3] = 0x64;

    frame.writeUInt16BE(0x0000, 4);
    frame.writeUInt8(0x00, 6);
    frame.writeUInt16BE(0x0a00, 7);
    frame.writeUInt16BE(0x0a00, 9);
    frame.writeUInt16BE(0x0a00, 11);
    frame.writeUInt16BE(0x0a00, 13);

    for (let p = 36; p < frameLen; p++) {
      frame[p] = (f * 17 + p * 31) & 0xff;
    }
    frames.push(frame);
  }

  return Buffer.concat([id3Header, id3Body, ...frames]);
}

// ==========================================
// 3. MP4 Video Generator (ftyp / moov / mdat)
// ==========================================
class BitWriter {
  private bits: number[] = [];
  writeBits(val: number, n: number) {
    for (let i = n - 1; i >= 0; i--) {
      this.bits.push((val >>> i) & 1);
    }
  }
  writeUe(val: number) {
    const v = val + 1;
    const len = Math.floor(Math.log2(v));
    for (let i = 0; i < len; i++) this.bits.push(0);
    this.writeBits(v, len + 1);
  }
  writeSe(val: number) {
    const mapped = val <= 0 ? -2 * val : 2 * val - 1;
    this.writeUe(mapped);
  }
  toBuffer(): Buffer {
    this.bits.push(1);
    while (this.bits.length % 8 !== 0) this.bits.push(0);
    const bytes = Buffer.alloc(this.bits.length / 8);
    for (let i = 0; i < this.bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) {
        b = (b << 1) | this.bits[i + j];
      }
      bytes[i / 8] = b;
    }
    return bytes;
  }
}

function makeAtom(type: string, payload: Buffer): Buffer {
  const buf = Buffer.alloc(8 + payload.length);
  buf.writeUInt32BE(buf.length, 0);
  buf.write(type, 4, 4, "ascii");
  payload.copy(buf, 8);
  return buf;
}

export function generateMp4Video(width = 800, height = 600, durationSeconds = 3): Buffer {
  // 1. ftyp Atom (32 bytes)
  const ftypPayload = Buffer.alloc(24);
  ftypPayload.write("isom", 0, 4, "ascii");
  ftypPayload.writeUInt32BE(0x00000200, 4);
  ftypPayload.write("isom", 8, 4, "ascii");
  ftypPayload.write("iso2", 12, 4, "ascii");
  ftypPayload.write("mp41", 16, 4, "ascii");
  ftypPayload.write("avc1", 20, 4, "ascii");
  const ftypAtom = makeAtom("ftyp", ftypPayload);

  // 2. Video SPS and PPS
  const mbWidth = Math.ceil(width / 16);
  const mbHeight = Math.ceil(height / 16);
  const cropBottom = (mbHeight * 16 - height) / 2;

  // SPS
  const spsBw = new BitWriter();
  spsBw.writeBits(0x42, 8); // baseline profile
  spsBw.writeBits(0xe0, 8); // constraints
  spsBw.writeBits(0x1f, 8); // level 3.1
  spsBw.writeUe(0); // seq_parameter_set_id
  spsBw.writeUe(0); // log2_max_frame_num_minus4
  spsBw.writeUe(0); // pic_order_cnt_type
  spsBw.writeUe(0); // log2_max_pic_order_cnt_lsb_minus4
  spsBw.writeUe(1); // max_num_ref_frames = 1
  spsBw.writeBits(0, 1); // gaps_in_frame_num_value_allowed_flag = 0
  spsBw.writeUe(mbWidth - 1); // pic_width_in_mbs_minus1
  spsBw.writeUe(mbHeight - 1); // pic_height_in_map_units_minus1
  spsBw.writeBits(1, 1); // frame_mbs_only_flag = 1
  spsBw.writeBits(1, 1); // direct_8x8_inference_flag = 1
  spsBw.writeBits(cropBottom > 0 ? 1 : 0, 1); // frame_cropping_flag
  if (cropBottom > 0) {
    spsBw.writeUe(0); // left
    spsBw.writeUe(0); // right
    spsBw.writeUe(0); // top
    spsBw.writeUe(cropBottom); // bottom
  }
  spsBw.writeBits(0, 1); // vui_parameters_present_flag = 0
  const spsPayload = spsBw.toBuffer();
  const sps = Buffer.concat([Buffer.from([0x67]), spsPayload]);

  // PPS
  const ppsBw = new BitWriter();
  ppsBw.writeUe(0); // pic_parameter_set_id
  ppsBw.writeUe(0); // seq_parameter_set_id
  ppsBw.writeBits(0, 1); // entropy_coding_mode_flag = 0 (CAVLC)
  ppsBw.writeBits(0, 1); // bottom_field_pic_order_in_frame_present_flag = 0
  ppsBw.writeUe(0); // num_slice_groups_minus1 = 0
  ppsBw.writeUe(0); // num_ref_idx_l0_default_active_minus1 = 0
  ppsBw.writeUe(0); // num_ref_idx_l1_default_active_minus1 = 0
  ppsBw.writeBits(0, 1); // weighted_pred_flag = 0
  ppsBw.writeBits(0, 2); // weighted_bipred_idc = 0
  ppsBw.writeSe(0); // pic_init_qp_minus26 = 0
  ppsBw.writeSe(0); // pic_init_qs_minus26 = 0
  ppsBw.writeSe(0); // chroma_qp_index_offset = 0
  ppsBw.writeBits(0, 1); // deblocking_filter_control_present_flag = 0
  ppsBw.writeBits(0, 1); // constrained_intra_pred_flag = 0
  ppsBw.writeBits(0, 1); // redundant_pic_cnt_present_flag = 0
  const ppsPayload = ppsBw.toBuffer();
  const pps = Buffer.concat([Buffer.from([0x68]), ppsPayload]);

  // Generate 30 frames (10 fps for 3s = 30 frames)
  const fps = 10;
  const totalFrames = fps * durationSeconds;
  const sampleDataList: Buffer[] = [];
  const sampleSizes: number[] = [];
  const totalMbs = mbWidth * mbHeight;

  for (let i = 0; i < totalFrames; i++) {
    const isIdr = i === 0;
    const bw = new BitWriter();
    bw.writeUe(0); // first_mb_in_slice = 0
    bw.writeUe(isIdr ? 7 : 2); // slice_type = 7 (I) or 2 (I)
    bw.writeUe(0); // pic_parameter_set_id = 0
    bw.writeBits(0, 4); // frame_num
    if (isIdr) {
      bw.writeUe(0); // idr_pic_id = 0
    }
    bw.writeBits(0, 4); // pic_order_cnt_lsb
    if (isIdr) {
      bw.writeBits(0, 1); // no_output_of_prior_pics_flag = 0
      bw.writeBits(0, 1); // long_term_reference_flag = 0
    }
    bw.writeSe(0); // slice_qp_delta = 0

    // Macroblocks with DC intra prediction
    for (let mb = 0; mb < totalMbs; mb++) {
      bw.writeUe(3); // mb_type: I_16x16_2_0_0 (DC prediction, cbp = 0)
      bw.writeUe(0); // intra_chroma_pred_mode: 0 (DC)
    }

    const payload = bw.toBuffer();
    const nalHeader = isIdr ? 0x65 : 0x01; // IDR (ref_idc 3) or non-ref slice (ref_idc 0)
    const frame = Buffer.concat([Buffer.from([nalHeader]), payload]);

    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(frame.length, 0);
    const sample = Buffer.concat([lenBuf, frame]);
    sampleDataList.push(sample);
    sampleSizes.push(sample.length);
  }

  const mdatPayload = Buffer.concat(sampleDataList);
  const mdatAtom = makeAtom("mdat", mdatPayload);

  // 3. moov Atom
  const timescale = 600;
  const duration = timescale * durationSeconds;

  // mvhd Atom (100 bytes)
  const mvhd = Buffer.alloc(100);
  mvhd.writeUInt8(0, 0);
  mvhd.writeUInt32BE(timescale, 12);
  mvhd.writeUInt32BE(duration, 16);
  mvhd.writeUInt32BE(0x00010000, 20);
  mvhd.writeUInt16BE(0x0100, 24);
  mvhd.writeUInt32BE(0x00010000, 36);
  mvhd.writeUInt32BE(0x00010000, 52);
  mvhd.writeUInt32BE(0x40000000, 68);
  mvhd.writeUInt32BE(2, 96);
  const mvhdAtom = makeAtom("mvhd", mvhd);

  // tkhd Atom (84 bytes)
  const tkhd = Buffer.alloc(84);
  tkhd.writeUInt8(0, 0);
  tkhd.writeUInt8(0x07, 3);
  tkhd.writeUInt32BE(1, 12);
  tkhd.writeUInt32BE(duration, 20);
  tkhd.writeUInt32BE(0x00010000, 36);
  tkhd.writeUInt32BE(0x00010000, 52);
  tkhd.writeUInt32BE(0x40000000, 68);
  tkhd.writeUInt32BE(width << 16, 76);
  tkhd.writeUInt32BE(height << 16, 80);
  const tkhdAtom = makeAtom("tkhd", tkhd);

  // mdhd Atom (24 bytes)
  const mdhd = Buffer.alloc(24);
  mdhd.writeUInt8(0, 0);
  mdhd.writeUInt32BE(timescale, 12);
  mdhd.writeUInt32BE(duration, 16);
  mdhd.writeUInt16BE(0x55c4, 20);
  const mdhdAtom = makeAtom("mdhd", mdhd);

  // hdlr Atom (37 bytes)
  const hdlr = Buffer.alloc(37);
  hdlr.write("vide", 8, 4, "ascii");
  hdlr.write("VideoHandler", 24, "ascii");
  const hdlrAtom = makeAtom("hdlr", hdlr);

  // vmhd Atom (12 bytes)
  const vmhd = Buffer.alloc(12);
  vmhd.writeUInt8(1, 3);
  const vmhdAtom = makeAtom("vmhd", vmhd);

  // dinf -> dref Atom
  const drefEntry = Buffer.alloc(12);
  drefEntry.writeUInt32BE(12, 0);
  drefEntry.write("url ", 4, 4, "ascii");
  drefEntry.writeUInt8(1, 11);

  const dref = Buffer.alloc(8 + 12);
  dref.writeUInt32BE(1, 4);
  drefEntry.copy(dref, 8);
  const drefAtom = makeAtom("dref", dref);
  const dinfAtom = makeAtom("dinf", drefAtom);

  // avcC Atom (AVC Configuration Box)
  const avcC = Buffer.alloc(11 + sps.length + pps.length);
  avcC.writeUInt8(1, 0);
  avcC.writeUInt8(0x42, 1);
  avcC.writeUInt8(0xe0, 2);
  avcC.writeUInt8(0x1f, 3);
  avcC.writeUInt8(0xff, 4);
  avcC.writeUInt8(0xe1, 5);
  avcC.writeUInt16BE(sps.length, 6);
  sps.copy(avcC, 8);
  let avcCOff = 8 + sps.length;
  avcC.writeUInt8(1, avcCOff); avcCOff += 1;
  avcC.writeUInt16BE(pps.length, avcCOff); avcCOff += 2;
  pps.copy(avcC, avcCOff);
  const avcCAtom = makeAtom("avcC", avcC);

  // VisualSampleEntry 'avc1'
  const avc1 = Buffer.alloc(78 + avcCAtom.length);
  avc1.writeUInt16BE(1, 6);
  avc1.writeUInt16BE(width, 24);
  avc1.writeUInt16BE(height, 26);
  avc1.writeUInt32BE(0x00480000, 28);
  avc1.writeUInt32BE(0x00480000, 32);
  avc1.writeUInt16BE(1, 40);
  avc1.writeUInt8(10, 42);
  avc1.write("AVC Coding", 43, 10, "ascii");
  avc1.writeUInt16BE(0x0018, 74);
  avc1.writeInt16BE(-1, 76);
  avcCAtom.copy(avc1, 78);
  const avc1Atom = makeAtom("avc1", avc1);

  // stsd Atom
  const stsd = Buffer.alloc(8 + avc1Atom.length);
  stsd.writeUInt32BE(1, 4);
  avc1Atom.copy(stsd, 8);
  const stsdAtom = makeAtom("stsd", stsd);

  // stts Atom (Time to sample)
  const stts = Buffer.alloc(16);
  stts.writeUInt32BE(1, 4);
  stts.writeUInt32BE(totalFrames, 8);
  stts.writeUInt32BE(timescale / fps, 12);
  const sttsAtom = makeAtom("stts", stts);

  // stsc Atom (Sample to Chunk)
  const stsc = Buffer.alloc(20);
  stsc.writeUInt32BE(1, 4);
  stsc.writeUInt32BE(1, 8);
  stsc.writeUInt32BE(totalFrames, 12);
  stsc.writeUInt32BE(1, 16);
  const stscAtom = makeAtom("stsc", stsc);

  // stsz Atom (Sample Sizes)
  const stsz = Buffer.alloc(12 + totalFrames * 4);
  stsz.writeUInt32BE(0, 4);
  stsz.writeUInt32BE(totalFrames, 8);
  for (let i = 0; i < totalFrames; i++) {
    stsz.writeUInt32BE(sampleSizes[i], 12 + i * 4);
  }
  const stszAtom = makeAtom("stsz", stsz);

  // stss Atom (Sync samples / Keyframes)
  const stss = Buffer.alloc(8 + 4);
  stss.writeUInt32BE(1, 4);
  stss.writeUInt32BE(1, 8);
  const stssAtom = makeAtom("stss", stss);

  // stco Atom (Chunk Offset)
  const chunkOffset = ftypAtom.length + 8;
  const stco = Buffer.alloc(12);
  stco.writeUInt32BE(1, 4);
  stco.writeUInt32BE(chunkOffset, 8);
  const stcoAtom = makeAtom("stco", stco);

  // stbl Atom
  const stbl = Buffer.concat([stsdAtom, sttsAtom, stscAtom, stszAtom, stssAtom, stcoAtom]);
  const stblAtom = makeAtom("stbl", stbl);

  // minf Atom
  const minf = Buffer.concat([vmhdAtom, dinfAtom, stblAtom]);
  const minfAtom = makeAtom("minf", minf);

  // mdia Atom
  const mdia = Buffer.concat([mdhdAtom, hdlrAtom, minfAtom]);
  const mdiaAtom = makeAtom("mdia", mdia);

  // trak Atom
  const trak = Buffer.concat([tkhdAtom, mdiaAtom]);
  const trakAtom = makeAtom("trak", trak);

  // moov Atom
  const moov = Buffer.concat([mvhdAtom, trakAtom]);
  const moovAtom = makeAtom("moov", moov);

  return Buffer.concat([ftypAtom, mdatAtom, moovAtom]);
}

// ==========================================
// 4. Database Record Saver
// ==========================================
export async function saveMediaAssetToDb(
  dbClient: DbClient,
  asset: {
    filename: string;
    mimeType: string;
    size: number;
    r2Key: string;
    hash: string;
  },
): Promise<number | undefined> {
  let insertedId: number | undefined;

  // 1. Supabase REST API Client if available
  if (dbClient.supabase) {
    try {
      const { data, error } = await dbClient.supabase
        .from("media_assets")
        .upsert(
          {
            filename: asset.filename,
            mime_type: asset.mimeType,
            size: asset.size,
            r2_key: asset.r2Key,
            hash: asset.hash,
          },
          { onConflict: "r2_key" },
        )
        .select("id")
        .single();

      if (!error && data?.id) {
        insertedId = Number(data.id);
      }
    } catch (err: any) {
      console.warn(`[DB Supabase REST] Notice saving media asset:`, err?.message || err);
    }
  }

  // 2. Direct Postgres SQL if available
  if (dbClient.sql) {
    try {
      const rows = await dbClient.sql`
        INSERT INTO media_assets (filename, mime_type, size, r2_key, hash)
        VALUES (${asset.filename}, ${asset.mimeType}, ${asset.size}, ${asset.r2Key}, ${asset.hash})
        ON CONFLICT (r2_key) DO UPDATE
        SET filename = EXCLUDED.filename, mime_type = EXCLUDED.mime_type, size = EXCLUDED.size, hash = EXCLUDED.hash
        RETURNING id;
      `;
      if (rows && rows.length > 0) {
        insertedId = Number(rows[0].id);
      }
    } catch (err: any) {
      // If direct postgres connection is unavailable, REST client or SQLite handles it
    }
  }

  // 3. SQLite Local DB (Always keep local SQLite database in sync as well)
  let sqliteDb: BetterSqlite3.Database | undefined = dbClient.sqlite;
  let shouldCloseSqlite = false;

  if (!sqliteDb) {
    try {
      let sqlitePath = process.env.DB_PATH ?? "wastat.db";
      if (sqlitePath.startsWith("/app/") && !existsSync("/app")) {
        sqlitePath = join(process.cwd(), "wastat.db");
      }
      mkdirSync(dirname(sqlitePath), { recursive: true });
      sqliteDb = new Database(sqlitePath);
      sqliteDb.pragma("journal_mode = WAL");
      try {
        const schemaSql = readFileSync(new URL("./db/schema.sql", import.meta.url), "utf8");
        sqliteDb.exec(schemaSql);
      } catch {}
      shouldCloseSqlite = true;
    } catch {}
  }

  if (sqliteDb) {
    try {
      const existing = sqliteDb
        .prepare("SELECT id FROM media_assets WHERE r2_key = ?")
        .get(asset.r2Key) as { id: number } | undefined;

      if (existing) {
        sqliteDb
          .prepare("UPDATE media_assets SET filename = ?, mime_type = ?, size = ?, hash = ? WHERE id = ?")
          .run(asset.filename, asset.mimeType, asset.size, asset.hash, existing.id);
        if (!insertedId) insertedId = existing.id;
      } else {
        const info = sqliteDb
          .prepare(`
            INSERT INTO media_assets (filename, mime_type, size, r2_key, hash)
            VALUES (?, ?, ?, ?, ?)
          `)
          .run(asset.filename, asset.mimeType, asset.size, asset.r2Key, asset.hash);
        if (!insertedId) insertedId = Number(info.lastInsertRowid);
      }
    } catch (err: any) {
      console.warn(`[DB SQLite] Notice updating media_assets:`, err?.message || err);
    } finally {
      if (shouldCloseSqlite) {
        try {
          sqliteDb.close();
        } catch {}
      }
    }
  }

  return insertedId;
}

// ==========================================
// 5. Main Orchestration & Uploader
// ==========================================
export interface GeneratedMediaResult {
  filename: string;
  mimeType: string;
  size: number;
  r2Key: string;
  hash: string;
  publicUrl: string;
  dbId?: number;
}

export interface UploadAllResults {
  image: GeneratedMediaResult;
  audioOgg: GeneratedMediaResult;
  audioMp3: GeneratedMediaResult;
  video: GeneratedMediaResult;
}

export async function generateAndUploadAllMedia(
  options: { storage?: StorageProvider; dbClient?: DbClient; localOutDir?: string } = {},
): Promise<UploadAllResults> {
  loadEnv();

  const storage = options.storage ?? createStorageFromEnv();
  const dbClient = options.dbClient ?? (await createDatabaseClient());

  console.log("🎨 Programmatically generating standalone multimedia binaries...");

  // 1. Generate PNG Image (800x600)
  const pngBuffer = generatePngImage(800, 600);
  const pngHash = createHash("sha256").update(pngBuffer).digest("hex");
  const pngKey = "safari-luxury-villa.png";

  // 2. Generate OGG Audio
  const oggBuffer = generateOggAudio();
  const oggHash = createHash("sha256").update(oggBuffer).digest("hex");
  const oggKey = "safari-welcome-audio.ogg";

  // 3. Generate MP3 Audio
  const mp3Buffer = generateMp3Audio();
  const mp3Hash = createHash("sha256").update(mp3Buffer).digest("hex");
  const mp3Key = "safari-welcome-audio.mp3";

  // 4. Generate MP4 Video (800x600 3s)
  const mp4Buffer = generateMp4Video(800, 600, 3);
  const mp4Hash = createHash("sha256").update(mp4Buffer).digest("hex");
  const mp4Key = "safari-luxury-tour.mp4";

  // Optionally save locally if requested or if output directory provided
  if (options.localOutDir) {
    mkdirSync(options.localOutDir, { recursive: true });
    writeFileSync(join(options.localOutDir, pngKey), pngBuffer);
    writeFileSync(join(options.localOutDir, oggKey), oggBuffer);
    writeFileSync(join(options.localOutDir, mp3Key), mp3Buffer);
    writeFileSync(join(options.localOutDir, mp4Key), mp4Buffer);
  }

  console.log(`🚀 Uploading to Cloudflare R2 / Storage Provider...`);

  // Upload to R2
  const pngUrl = await storage.put(pngKey, pngBuffer, "image/png");
  const oggUrl = await storage.put(oggKey, oggBuffer, "audio/ogg");
  const mp3Url = await storage.put(mp3Key, mp3Buffer, "audio/mpeg");
  const mp4Url = await storage.put(mp4Key, mp4Buffer, "video/mp4");

  console.log(`💾 Saving records into media_assets table...`);

  const pngId = await saveMediaAssetToDb(dbClient, {
    filename: pngKey,
    mimeType: "image/png",
    size: pngBuffer.length,
    r2Key: pngKey,
    hash: pngHash,
  });

  const oggId = await saveMediaAssetToDb(dbClient, {
    filename: oggKey,
    mimeType: "audio/ogg",
    size: oggBuffer.length,
    r2Key: oggKey,
    hash: oggHash,
  });

  const mp3Id = await saveMediaAssetToDb(dbClient, {
    filename: mp3Key,
    mimeType: "audio/mpeg",
    size: mp3Buffer.length,
    r2Key: mp3Key,
    hash: mp3Hash,
  });

  const mp4Id = await saveMediaAssetToDb(dbClient, {
    filename: mp4Key,
    mimeType: "video/mp4",
    size: mp4Buffer.length,
    r2Key: mp4Key,
    hash: mp4Hash,
  });

  const results: UploadAllResults = {
    image: {
      filename: pngKey,
      mimeType: "image/png",
      size: pngBuffer.length,
      r2Key: pngKey,
      hash: pngHash,
      publicUrl: pngUrl,
      dbId: pngId,
    },
    audioOgg: {
      filename: oggKey,
      mimeType: "audio/ogg",
      size: oggBuffer.length,
      r2Key: oggKey,
      hash: oggHash,
      publicUrl: oggUrl,
      dbId: oggId,
    },
    audioMp3: {
      filename: mp3Key,
      mimeType: "audio/mpeg",
      size: mp3Buffer.length,
      r2Key: mp3Key,
      hash: mp3Hash,
      publicUrl: mp3Url,
      dbId: mp3Id,
    },
    video: {
      filename: mp4Key,
      mimeType: "video/mp4",
      size: mp4Buffer.length,
      r2Key: mp4Key,
      hash: mp4Hash,
      publicUrl: mp4Url,
      dbId: mp4Id,
    },
  };

  return results;
}

// Standalone execution entrypoint
if (
  process.argv[1] &&
  (process.argv[1].endsWith("generate-and-upload-r2.ts") || process.argv[1].endsWith("generate-and-upload-r2.js"))
) {
  generateAndUploadAllMedia()
    .then((res) => {
      console.log("\n=======================================================");
      console.log("🎉 MEDIA ASSETS GENERATED & UPLOADED TO CLOUDFLARE R2");
      console.log("=======================================================");
      console.log(`🖼️  Image:      ${res.image.publicUrl} (${res.image.size} bytes, DB ID: ${res.image.dbId ?? "synced"})`);
      console.log(`🎵 Audio (OGG): ${res.audioOgg.publicUrl} (${res.audioOgg.size} bytes, DB ID: ${res.audioOgg.dbId ?? "synced"})`);
      console.log(`🎵 Audio (MP3): ${res.audioMp3.publicUrl} (${res.audioMp3.size} bytes, DB ID: ${res.audioMp3.dbId ?? "synced"})`);
      console.log(`🎬 Video (MP4): ${res.video.publicUrl} (${res.video.size} bytes, DB ID: ${res.video.dbId ?? "synced"})`);
      console.log("=======================================================\n");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Failed to generate and upload media:", err);
      process.exit(1);
    });
}
