/**
 * 图片尺寸检测工具
 * @description 从 image-size 库中提取的精简版本，支持常见图片格式
 * 支持格式：PNG, JPG/JPEG, GIF, WebP, BMP
 */

// ============ 工具函数 ============
const decoder = new TextDecoder();
const toUTF8String = (input: Uint8Array, start = 0, end = input.length) =>
  decoder.decode(input.slice(start, end));


const getView = (input: Uint8Array, offset: number) =>
  new DataView(input.buffer, input.byteOffset + offset);

const readUInt16BE = (input: Uint8Array, offset = 0) => getView(input, offset).getUint16(0, false);
const readUInt16LE = (input: Uint8Array, offset = 0) => getView(input, offset).getUint16(0, true);
const readUInt32BE = (input: Uint8Array, offset = 0) => getView(input, offset).getUint32(0, false);
const readUInt32LE = (input: Uint8Array, offset = 0) => getView(input, offset).getUint32(0, true);
const readInt32LE = (input: Uint8Array, offset = 0) => getView(input, offset).getInt32(0, true);

// ============ 图片类型检测器 ============

interface ImageSize {
  width: number;
  height: number;
  type?: string;
}

// PNG 检测
const PNG = {
  validate: (input: Uint8Array) =>
    input[0] === 137 &&
    input[1] === 80 &&
    input[2] === 78 &&
    input[3] === 71 &&
    input[4] === 13 &&
    input[5] === 10 &&
    input[6] === 26 &&
    input[7] === 10,
  calculate: (input: Uint8Array): ImageSize => ({
    height: readUInt32BE(input, 20),
    width: readUInt32BE(input, 16),
  }),
};

// JPG 检测
const JPG = {
  validate: (input: Uint8Array) => input[0] === 255 && input[1] === 216,
  calculate: (input: Uint8Array): ImageSize => {
    let i = 2;
    while (i < input.length) {
      if (input[i] !== 255) {
        throw new TypeError("Invalid JPG, marker table corrupted");
      }
      const marker = input[i + 1];
      if (marker === 192 || marker === 193 || marker === 194) {
        return {
          height: readUInt16BE(input, i + 5),
          width: readUInt16BE(input, i + 7),
        };
      }
      i += 2 + readUInt16BE(input, i + 2);
    }
    throw new TypeError("Invalid JPG, no size found");
  },
};

// GIF 检测
const GIF = {
  validate: (input: Uint8Array) =>
    input[0] === 71 && input[1] === 73 && input[2] === 70,
  calculate: (input: Uint8Array): ImageSize => ({
    height: readUInt16LE(input, 8),
    width: readUInt16LE(input, 6),
  }),
};

// BMP 检测
const BMP = {
  validate: (input: Uint8Array) => toUTF8String(input, 0, 2) === "BM",
  calculate: (input: Uint8Array): ImageSize => ({
    height: Math.abs(readInt32LE(input, 22)),
    width: readUInt32LE(input, 18),
  }),
};

// WebP 检测
const WEBP = {
  validate(input: Uint8Array) {
    const riffHeader = toUTF8String(input, 0, 4) === "RIFF";
    const webpHeader = toUTF8String(input, 8, 12) === "WEBP";
    const vp8Header = toUTF8String(input, 12, 15) === "VP8";
    return riffHeader && webpHeader && vp8Header;
  },
  calculate(input: Uint8Array): ImageSize {
    const chunkHeader = toUTF8String(input, 12, 16);
    if (chunkHeader === "VP8 ") {
      // Lossy WebP
      return {
        width: readUInt16LE(input, 26) & 16383,
        height: readUInt16LE(input, 28) & 16383,
      };
    }
    if (chunkHeader === "VP8L") {
      // Lossless WebP
      const bits = readUInt32LE(input, 21);
      return {
        width: ((bits & 16383) + 1),
        height: (((bits >> 14) & 16383) + 1),
      };
    }
    if (chunkHeader === "VP8X") {
      // Extended WebP
      return {
        width: (readUInt32LE(input, 24) & 16777215) + 1,
        height: ((readUInt32LE(input, 26) & 16777215) >> 8) + 1,
      };
    }
    throw new TypeError("Invalid WebP");
  },
};

// ============ 主检测函数 ============

const typeHandlers = new Map<string, { validate: (input: Uint8Array) => boolean; calculate: (input: Uint8Array) => ImageSize }>([
  ["png", PNG],
  ["jpg", JPG],
  ["gif", GIF],
  ["bmp", BMP],
  ["webp", WEBP],
]);

const firstBytes = new Map<number, string>([
  [66, "bmp"],    // 'B'
  [71, "gif"],    // 'G'
  [82, "webp"],   // 'R'
  [137, "png"],   // PNG signature
  [255, "jpg"],   // JPEG signature
]);

function detector(input: Uint8Array): string | undefined {
  const byte = input[0];
  const type = firstBytes.get(byte);
  if (type && typeHandlers.get(type)!.validate(input)) {
    return type;
  }
  // 如果首字节匹配失败，尝试所有类型
  for (const [typeName, handler] of typeHandlers) {
    if (handler.validate(input)) {
      return typeName;
    }
  }
  return undefined;
}

/**
 * 获取图片尺寸
 * @param input - 图片数据的 Buffer 或 Uint8Array
 * @returns 图片尺寸信息 { width, height, type }
 */
export function imageSize(input: Buffer | Uint8Array): ImageSize {
  const uint8Array = input instanceof Buffer ? new Uint8Array(input) : input;
  
  const type = detector(uint8Array);
  if (typeof type !== "undefined") {
    const handler = typeHandlers.get(type);
    if (handler) {
      const size = handler.calculate(uint8Array);
      if (size !== undefined) {
        size.type = type;
        return size;
      }
    }
  }
  
  throw new TypeError(`Unsupported file type: ${type}`);
}

export default imageSize;
