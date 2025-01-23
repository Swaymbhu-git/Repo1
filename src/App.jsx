import React, { useState } from "react";
import "./App.css";

const EOF_CHAR = '□'; // Pseudo-EOF character

function App() {
  const [fileContent, setFileContent] = useState("");
  const [compressedContent, setCompressedContent] = useState("");
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);
  const [decryptedContent, setDecryptedContent] = useState("");
  const [huffmanTree, setHuffmanTree] = useState(null);

  // Huffman compression logic
  const huffmanCompress = (text) => {
    const freqMap = {};
    for (const char of text) {
      freqMap[char] = (freqMap[char] || 0) + 1;
    }
    freqMap[EOF_CHAR] = 1; // Ensure EOF_CHAR is part of the tree

    const pq = Object.entries(freqMap).map(([char, freq]) => ({
      char,
      freq,
      left: null,
      right: null,
    }));
    pq.sort((a, b) => a.freq - b.freq);

    while (pq.length > 1) {
      const left = pq.shift();
      const right = pq.shift();
      pq.push({
        char: null,
        freq: left.freq + right.freq,
        left,
        right,
      });
      pq.sort((a, b) => a.freq - b.freq);
    }

    const huffmanTree = pq[0];
    setHuffmanTree(huffmanTree);

    const huffmanCodes = {};
    const generateCodes = (node, code) => {
      if (!node) return;
      if (node.char !== null) {
        huffmanCodes[node.char] = code;
      }
      generateCodes(node.left, code + "0");
      generateCodes(node.right, code + "1");
    };
    generateCodes(huffmanTree, "");

    const encodedText = text.split("").map((char) => huffmanCodes[char]).join("");

    return { encodedText, huffmanTree, huffmanCodes };
  };

  // Huffman decompression logic
  const huffmanDecompress = (encodedText, tree) => {
    let result = "";
    let node = tree;

    for (const bit of encodedText) {
      node = bit === "0" ? node.left : node.right;
      if (!node.left && !node.right) {
        if (node.char === EOF_CHAR) {
          break; // Stop decoding at EOF_CHAR
        }
        result += node.char;
        node = tree;
      }
    }

    return result;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        setFileContent(text);
        setOriginalSize(text.length); // Approximate size in bytes
      };
      reader.readAsText(file);
    }
  };

  const handleCompress = () => {
    const { encodedText } = huffmanCompress(fileContent + EOF_CHAR);
    setCompressedContent(encodedText);
    setCompressedSize(encodedText.length / 8); // Approximate size in bytes
  };

  const downloadCompressedFile = () => {
    const inputWithEOF = fileContent + EOF_CHAR;
    const { encodedText, huffmanTree } = huffmanCompress(inputWithEOF);

    let p = 0; // Current byte
    let curr = 7; // Bit position in the byte
    const binaryBuffer = []; // Array to hold the bytes

    for (let i = 0; i < encodedText.length; i++) {
      if (encodedText[i] === "1") {
        p |= (1 << curr); // Set the bit at position `curr`
      }
      curr--;
      if (curr < 0) {
        binaryBuffer.push(p);
        p = 0; // Reset the byte
        curr = 7; // Reset the bit position
      }
    }

    const trashBits = curr + 1; // Remaining unused bits in the last byte
    if (curr < 7) {
      binaryBuffer.push(p); // Add the last byte
    }

    const serializeTree = (node) => {
      if (!node.left && !node.right) {
        return `1${node.char}`;
      }
      return `0${serializeTree(node.left)}${serializeTree(node.right)}`;
    };
    const serializedTree = serializeTree(huffmanTree);

    const treeBuffer = new TextEncoder().encode(serializedTree);
    const treeLengthBuffer = new Uint32Array([treeBuffer.length]); // Tree length as 4 bytes

    binaryBuffer.push(trashBits); // Add trash bits as the last byte
    const binaryData = new Uint8Array(binaryBuffer);

    const combinedBuffer = new Blob([treeLengthBuffer.buffer, treeBuffer, binaryData]);

    const link = document.createElement("a");
    link.href = URL.createObjectURL(combinedBuffer);
    link.download = "compressed_file.bin";
    link.click();
  };

  const handleDecompressionFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const buffer = event.target.result;

        const treeLengthBuffer = new Uint32Array(buffer.slice(0, 4));
        const treeLength = treeLengthBuffer[0];

        const serializedTree = new TextDecoder().decode(buffer.slice(4, 4 + treeLength));
        const binaryBuffer = new Uint8Array(buffer.slice(4 + treeLength));

        const trashBits = binaryBuffer[binaryBuffer.length - 1]; // Trash bits are in the last byte
        const binaryData = binaryBuffer.slice(0, -1); // Exclude the last byte (trash bits info)

        const deserializeTree = (serializedTree) => {
          let i = 0;
          const buildTree = () => {
            if (serializedTree[i] === "1") {
              i++;
              return { char: serializedTree[i++], left: null, right: null };
            }
            i++;
            const left = buildTree();
            const right = buildTree();
            return { char: null, left, right };
          };
          return buildTree();
        };
        const huffmanTree = deserializeTree(serializedTree);

        const compressedContent = Array.from(binaryData)
          .map((byte) => byte.toString(2).padStart(8, "0"))
          .join("");

        const validContent = compressedContent.slice(0, compressedContent.length - trashBits); // Remove trash bits

        let originalText = huffmanDecompress(validContent, huffmanTree);
        originalText = originalText.replace(EOF_CHAR, ""); // Remove EOF_CHAR from the decoded text
        setDecryptedContent(originalText);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const downloadDecryptedFile = () => {
    const blob = new Blob([decryptedContent], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "decrypted_file.txt"; // Save the file as .txt
    link.click();
  };

  return (
<div className="app">
  <h1>Encryption and Decryption Tool</h1>
  <div className="section">
    <h2>Encrypt File</h2>
    <input type="file" accept=".txt" onChange={handleFileUpload} />
    {fileContent && (
      <>
        <p>Original File Size: {originalSize} bytes</p>
        <button onClick={handleCompress}>Encrypt</button>
      </>
    )}
    {compressedContent && (
      <>
        <p>Encrypted File Size: {compressedSize} bytes</p>
        <button onClick={downloadCompressedFile}>Download Encrypted File</button>
      </>
    )}
  </div>
  <div className="section">
    <h2>Decrypt File</h2>
    <input type="file" accept=".bin" onChange={handleDecompressionFileUpload} />
    {decryptedContent && (
      <>
        <button onClick={downloadDecryptedFile}>Download Decrypted File</button>
      </>
    )}
  </div>
</div>

  );
}

export default App;
