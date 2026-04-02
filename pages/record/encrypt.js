// XOR Key
const ENCRYPT_KEY = 0xAB;
const HEADER_SIZE = 1024;
const CHUNK_SIZE = 512 * 1024; // 512KB chunks for memory safety
const INNER_WRITE_CHUNK_SIZE = 32 * 1024;

const safeClose = (handle) => {
	// #ifdef APP-PLUS
	if (!handle) {
		return;
	}
	try {
		plus.ios.invoke(handle, 'closeFile');
	} catch (e) {}
	try {
		plus.ios.deleteObject(handle);
	} catch (e) {}
	// #endif
};

const safeDelete = (obj) => {
	// #ifdef APP-PLUS
	if (!obj) {
		return;
	}
	try {
		plus.ios.deleteObject(obj);
	} catch (e) {}
	// #endif
};

const toSystemPath = (filePath) => {
	// #ifdef APP-PLUS
	return plus.io.convertLocalFileSystemURL(filePath);
	// #endif
	// #ifndef APP-PLUS
	return filePath;
	// #endif
};

const binaryStringToUint8Array = (binaryStr) => {
	const len = binaryStr.length;
	const view = new Uint8Array(len);
	for (let i = 0; i < len; i += 1) {
		view[i] = binaryStr.charCodeAt(i);
	}
	return view;
};

const uint8ArrayToBinaryString = (dataView) => {
	let binary = '';
	for (let i = 0; i < dataView.length; i += INNER_WRITE_CHUNK_SIZE) {
		const end = Math.min(i + INNER_WRITE_CHUNK_SIZE, dataView.length);
		binary += String.fromCharCode.apply(null, dataView.subarray(i, end));
	}
	return binary;
};

const xorBuffer = (dataView) => {
	for (let i = 0; i < dataView.length; i += 1) {
		dataView[i] ^= ENCRYPT_KEY;
	}
	return dataView;
};

const readChunkByFileReader = (file, offset, length) => {
	return new Promise((resolve, reject) => {
		const reader = new plus.io.FileReader();
		const blob = file.slice(offset, offset + length);

		reader.onloadend = (e) => {
			if (!e.target.result) {
				reject(new Error('Read result empty'));
				return;
			}
			try {
				const resultStr = e.target.result;
				const base64 = resultStr.indexOf(',') > -1 ? resultStr.split(',')[1] : resultStr;
				const binaryStr = atob(base64);
				resolve(binaryStringToUint8Array(binaryStr));
			} catch (err) {
				reject(new Error('Chunk decode failed: ' + err.message));
			}
		};

		reader.onerror = (e) => reject(new Error('Read failed: ' + JSON.stringify(e)));
		reader.readAsDataURL(blob);
	});
};

const readChunkIOS = (filePath, offset, length) => {
	return new Promise((resolve, reject) => {
		try {
			const sysPath = toSystemPath(filePath);
			const NSFileHandle = plus.ios.importClass('NSFileHandle');
			const handle = NSFileHandle.fileHandleForReadingAtPath(sysPath);
			if (!handle) {
				reject(new Error('Open file for iOS reading failed'));
				return;
			}
			plus.ios.importClass(handle);

			handle.seekToFileOffset(offset);
			const data = handle.readDataOfLength(length);
			if (!data) {
				safeClose(handle);
				reject(new Error('Read NSData failed'));
				return;
			}
			plus.ios.importClass(data);

			const base64 = data.base64EncodedStringWithOptions(0);
			safeDelete(data);
			safeClose(handle);

			if (!base64) {
				resolve(new Uint8Array(0));
				return;
			}

			resolve(binaryStringToUint8Array(atob(base64)));
		} catch (error) {
			reject(new Error('iOS read failed: ' + (error.message || error)));
		}
	});
};

const writeChunkAndroid = (filePath, dataView, offset) => {
	const RandomAccessFile = plus.android.importClass('java.io.RandomAccessFile');
	const sysPath = toSystemPath(filePath);
	const raf = new RandomAccessFile(sysPath, 'rw');
	try {
		raf.seek(offset);
		for (let i = 0; i < dataView.length; i += INNER_WRITE_CHUNK_SIZE) {
			const end = Math.min(i + INNER_WRITE_CHUNK_SIZE, dataView.length);
			const binaryString = String.fromCharCode.apply(null, dataView.subarray(i, end));
			raf.writeBytes(binaryString);
		}
	} finally {
		raf.close();
	}
};

const writeChunkIOS = (filePath, dataView, offset) => {
	const sysPath = toSystemPath(filePath);
	const NSData = plus.ios.importClass('NSData');
	const NSFileHandle = plus.ios.importClass('NSFileHandle');
	const base64 = btoa(uint8ArrayToBinaryString(dataView));
	let nsData = null;
	let handle = null;

	try {
		nsData = new NSData();
		nsData = nsData.initWithBase64EncodedStringoptions(base64, 0);
		if (!nsData) {
			throw new Error('Create NSData failed');
		}
		plus.ios.importClass(nsData);

		handle = NSFileHandle.fileHandleForUpdatingAtPath(sysPath);
		if (!handle) {
			throw new Error('Open file for iOS writing failed');
		}
		plus.ios.importClass(handle);

		handle.seekToFileOffset(offset);
		handle.writeData(nsData);
		handle.synchronizeFile();
	} finally {
		safeDelete(nsData);
		safeClose(handle);
	}
};

/**
 * Helper: Read and Encrypt/Decrypt a chunk
 */
const readAndProcessChunk = async (file, filePath, offset, length) => {
	let view;

	// #ifdef APP-PLUS
	if (plus.os.name === 'iOS') {
		view = await readChunkIOS(filePath, offset, length);
	} else {
		view = await readChunkByFileReader(file, offset, length);
	}
	// #endif

	// #ifndef APP-PLUS
	view = new Uint8Array(0);
	// #endif

	return xorBuffer(view);
};

/**
 * Helper: Write data to file at specific offset
 * @param {string} filePath - Absolute system path
 * @param {Uint8Array} dataView - Data to write
 * @param {number} offset - Offset to write at
 */
const writeChunk = (filePath, dataView, offset) => {
	return new Promise((resolve, reject) => {
		// #ifdef APP-PLUS
		try {
			if (plus.os.name === 'Android') {
				writeChunkAndroid(filePath, dataView, offset);
			} else if (plus.os.name === 'iOS') {
				writeChunkIOS(filePath, dataView, offset);
			} else {
				throw new Error('Unsupported platform: ' + plus.os.name);
			}
			resolve();
			return;
		} catch (error) {
			reject(new Error('Write chunk failed: ' + (error.message || error)));
			return;
		}
		// #endif

		// #ifndef APP-PLUS
		reject(new Error('Encryption only supported in App environment'));
		// #endif
	});
};

/**
 * Process file (Encrypt/Decrypt)
 * @param {string} sourcePath - Source file path
 * @param {object} options - Options { limit: number, full: boolean }
 * @returns {Promise<string>}
 */
const processFile = (sourcePath, options = {}) => {
	const limit = options.limit || 0;
	const isFull = options.full || false;

	return new Promise((resolve, reject) => {
		// #ifndef APP-PLUS
		reject(new Error('Only supported in App environment'));
		return;
		// #endif

		plus.io.resolveLocalFileSystemURL(sourcePath, (entry) => {
			entry.file(async (file) => {
				try {
					const fileSize = file.size;

					if (isFull) {
						let offset = 0;
						while (offset < fileSize) {
							const currentChunkSize = Math.min(CHUNK_SIZE, fileSize - offset);
							const processedData = await readAndProcessChunk(file, sourcePath, offset, currentChunkSize);
							await writeChunk(sourcePath, processedData, offset);
							offset += currentChunkSize;
						}
					} else if (fileSize > 0) {
						const processSize = limit > 0 ? limit : HEADER_SIZE;
						const actualSize = Math.min(fileSize, processSize);
						const processedData = await readAndProcessChunk(file, sourcePath, 0, actualSize);
						await writeChunk(sourcePath, processedData, 0);
					}

					resolve(sourcePath);
				} catch (error) {
					reject(error);
				}
			}, (e) => reject(new Error('Get File object failed: ' + e.message)));
		}, (e) => reject(new Error('Resolve source path failed: ' + e.message)));
	});
};

/**
 * Encrypt video file (In-place, 1KB header)
 * @param {string} filePath
 */
export const encryptVideo = (filePath) => {
	return processFile(filePath, {
		limit: HEADER_SIZE
	});
};

/**
 * Decrypt video file (In-place, 1KB header)
 * @param {string} filePath
 */
export const decryptVideo = (filePath) => {
	return processFile(filePath, {
		limit: HEADER_SIZE
	});
};

/**
 * Encrypt audio file (In-place, FULL content)
 * Uses chunking to prevent OOM
 * @param {string} filePath
 */
export const encryptAudio = (filePath) => {
	return processFile(filePath, {
		full: true
	});
};

/**
 * Decrypt audio file (In-place, FULL content)
 * @param {string} filePath
 */
export const decryptAudio = (filePath) => {
	return processFile(filePath, {
		full: true
	});
};

// Export helper to copy file if needed
export const copyFile = (sourcePath, targetDir, newName) => {
	return new Promise((resolve, reject) => {
		plus.io.resolveLocalFileSystemURL(sourcePath, (entry) => {
			plus.io.resolveLocalFileSystemURL(targetDir, (dirEntry) => {
				entry.copyTo(dirEntry, newName, (newEntry) => {
					resolve(newEntry.fullPath);
				}, (e) => reject(e));
			}, (e) => reject(e));
		}, (e) => reject(e));
	});
};
