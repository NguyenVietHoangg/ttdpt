/**
 * LZW Compression and Decompression Engine with detailed step-by-step tracing
 */

class LZWEngine {
  /**
   * Helper to check if a character is ASCII
   */
  static isASCII(str) {
    return /^[\x00-\x7F]*$/.test(str);
  }

  /**
   * Get unique characters of a string, sorted
   */
  static getUniqueChars(text) {
    const chars = [...new Set(text)];
    chars.sort();
    return chars;
  }

  /**
   * Initialize dictionary based on type
   * @param {string} type - 'ascii', 'az', 'custom'
   * @param {string} text - The input text (required for 'custom')
   * @returns {Object} { dict, revDict, size }
   */
  static initDictionary(type, text = '') {
    const dict = {}; // String -> Code
    const revDict = {}; // Code -> String
    let size = 0;

    if (type === 'az') {
      // Initialize with A-Z (codes 1 to 26)
      for (let i = 0; i < 26; i++) {
        const char = String.fromCharCode(65 + i);
        dict[char] = i + 1;
        revDict[i + 1] = char;
      }
      size = 26;

      // Append any other characters found in text (like space, punctuation)
      if (text) {
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          if (dict[char] === undefined) {
            size++;
            dict[char] = size;
            revDict[size] = char;
          }
        }
      }
    } else if (type === 'custom') {
      // Initialize with unique characters in the text, sorted
      const unique = this.getUniqueChars(text);
      unique.forEach((char, index) => {
        dict[char] = index + 1;
        revDict[index + 1] = char;
      });
      size = unique.length;
    } else {
      // Default: ASCII 0-255
      for (let i = 0; i < 256; i++) {
        const char = String.fromCharCode(i);
        dict[char] = i;
        revDict[i] = char;
      }
      size = 256;

      // Append any characters with charCode > 255 found in text (Unicode/Vietnamese accented characters)
      if (text) {
        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          if (dict[char] === undefined) {
            dict[char] = size;
            revDict[size] = char;
            size++;
          }
        }
      }
    }

    return { dict, revDict, size };
  }

  /**
   * LZW Encoder with detailed trace
   * @param {string} text - Input text
   * @param {string} dictType - 'ascii', 'az', 'custom'
   */
  static encode(text, dictType = 'ascii') {
    if (!text) {
      return { codes: [], trace: [], initialDict: {}, finalDict: {} };
    }

    const { dict, size } = this.initDictionary(dictType, text);
    const initialDict = { ...dict };
    const trace = [];
    const codes = [];
    let nextCode = size + (dictType === 'ascii' ? 0 : 1);
    
    // Copy dictionary to track updates
    const currentDict = { ...dict };

    let w = "";
    let step = 1;

    for (let i = 0; i < text.length; i++) {
      const k = text[i];
      const wk = w + k;

      if (currentDict[wk] !== undefined) {
        // Record trace for keeping matching sequence
        trace.push({
          step: step++,
          w: w,
          k: k,
          wk: wk,
          inDict: true,
          outputCode: null,
          dictAddedString: null,
          dictAddedCode: null,
          action: `"${wk}" đã có trong từ điển. Cập nhật chuỗi hiện tại W = "${wk}".`
        });
        w = wk;
      } else {
        // Output code for W
        const outputCode = currentDict[w];
        codes.push(outputCode);

        // Add W+K to dictionary
        currentDict[wk] = nextCode;

        trace.push({
          step: step++,
          w: w,
          k: k,
          wk: wk,
          inDict: false,
          outputCode: outputCode,
          dictAddedString: wk,
          dictAddedCode: nextCode,
          action: `"${wk}" chưa có trong từ điển. Xuất mã của W ("${w}") là ${outputCode}. Thêm "${wk}" vào từ điển với mã ${nextCode}. Đặt W = "${k}".`
        });

        nextCode++;
        w = k;
      }
    }

    // Output code for final W
    if (w !== "") {
      const outputCode = currentDict[w];
      codes.push(outputCode);
      trace.push({
        step: step++,
        w: w,
        k: "Ø",
        wk: "Ø",
        inDict: null,
        outputCode: outputCode,
        dictAddedString: null,
        dictAddedCode: null,
        action: `Kết thúc chuỗi. Xuất mã của W ("${w}") còn lại là ${outputCode}.`
      });
    }

    return {
      codes,
      trace,
      initialDict,
      finalDict: currentDict,
      dictType
    };
  }

  /**
   * LZW Decoder with detailed trace
   * @param {Array<number>} codes - Input LZW codes
   * @param {string} dictType - 'ascii', 'az', 'custom'
   * @param {string} originalText - For 'custom' dictionary initialization
   */
  static decode(codes, dictType = 'ascii', originalText = '') {
    if (!codes || codes.length === 0) {
      return { text: "", trace: [], finalDict: {} };
    }

    const { revDict, size } = this.initDictionary(dictType, originalText);
    const trace = [];
    let nextCode = size + (dictType === 'ascii' ? 0 : 1);
    
    // Copy dictionary to track updates
    const currentRevDict = { ...revDict };

    let step = 1;
    let decodedChars = [];
    
    // Process first code
    let oldCode = codes[0];
    let s = currentRevDict[oldCode];
    if (s === undefined) {
      throw new Error(`Mã lỗi đầu tiên không tìm thấy trong từ điển: ${oldCode}`);
    }
    decodedChars.push(s);

    trace.push({
      step: step++,
      inputCode: oldCode,
      outputString: s,
      dictAddedString: null,
      dictAddedCode: null,
      notes: `Mã đầu tiên: Nhận ${oldCode}. Tra từ điển được chuỗi "${s}". Xuất chuỗi "${s}".`
    });

    let c = s[0]; // first character of s

    for (let i = 1; i < codes.length; i++) {
      const code = codes[i];
      let entry = "";
      let isSpecialCase = false;

      if (currentRevDict[code] !== undefined) {
        entry = currentRevDict[code];
      } else if (code === nextCode) {
        entry = s + c;
        isSpecialCase = true;
      } else {
        throw new Error(`Lỗi giải mã: mã ${code} không hợp lệ ở vị trí ${i}`);
      }

      decodedChars.push(entry);
      c = entry[0];

      // Add s + c to dictionary
      const newDictEntry = s + c;
      currentRevDict[nextCode] = newDictEntry;

      trace.push({
        step: step++,
        inputCode: code,
        outputString: entry,
        dictAddedString: newDictEntry,
        dictAddedCode: nextCode,
        notes: isSpecialCase 
          ? `Trường hợp đặc biệt (mã chưa định nghĩa): Nhận mã ${code} = nextCode. Chuỗi xuất ra = W + c = "${s}" + "${c}" = "${entry}". Thêm "${newDictEntry}" vào từ điển với mã ${nextCode}.`
          : `Nhận mã ${code}. Tra từ điển được chuỗi "${entry}". Xuất chuỗi "${entry}". Thêm W + c = "${s}" + "${c}" = "${newDictEntry}" vào từ điển với mã ${nextCode}.`
      });

      nextCode++;
      s = entry;
    }

    return {
      text: decodedChars.join(""),
      trace,
      finalDict: currentRevDict
    };
  }

  /**
   * Calculate exact statistics of compression
   */
  static getStats(originalText, codes, dictType) {
    const originalLength = originalText.length;
    let maxCode = 255;
    if (dictType === 'az') maxCode = 26;
    if (dictType === 'custom') maxCode = this.getUniqueChars(originalText).length;
    
    // Add the generated codes
    const finalMaxCode = maxCode + codes.length;
    const bitsPerCode = Math.ceil(Math.log2(Math.max(finalMaxCode, 2)));
    
    const originalBits = originalLength * 8;
    const compressedBits = codes.length * bitsPerCode;
    const ratio = (originalBits / compressedBits).toFixed(2);
    const spaceSaving = ((1 - (compressedBits / originalBits)) * 100).toFixed(1);

    return {
      originalChars: originalLength,
      originalBits,
      compressedCodes: codes.length,
      bitsPerCode,
      compressedBits,
      ratio,
      spaceSaving: parseFloat(spaceSaving) < 0 ? "0.0" : spaceSaving
    };
  }
}

// Export for node or browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LZWEngine;
} else {
  window.LZWEngine = LZWEngine;
}
