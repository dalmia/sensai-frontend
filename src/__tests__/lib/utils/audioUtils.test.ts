import { blobToBase64, resampleAudio, convertAudioBufferToWav, writeString } from "../../../lib/utils/audioUtils";

// Minimal AudioBuffer mock to be used in tests
class MockAudioBuffer {
    length: number;
    numberOfChannels: number;
    sampleRate: number;
    private channels: Float32Array[];

    constructor(opts: { length: number; numberOfChannels: number; sampleRate: number }) {
        this.length = opts.length;
        this.numberOfChannels = opts.numberOfChannels;
        this.sampleRate = opts.sampleRate;
        this.channels = Array.from({ length: this.numberOfChannels }, () => new Float32Array(this.length));
    }

    getChannelData(channel: number): Float32Array {
        return this.channels[channel];
    }
}

// Minimal FileReader mock
class MockFileReader {
    public result: string | ArrayBuffer | null = null;
    public onloadend: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
    public onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;

    readAsDataURL(_blob: Blob) {
        // No-op; tests will set `result` and trigger onloadend manually
    }
}

describe("audioUtils", () => {
    const OriginalAudioBuffer = (global as any).AudioBuffer;
    const OriginalFileReader = (global as any).FileReader;

    beforeAll(() => {
        (global as any).AudioBuffer = MockAudioBuffer;
        (global as any).FileReader = MockFileReader;
    });

    afterAll(() => {
        (global as any).AudioBuffer = OriginalAudioBuffer;
        (global as any).FileReader = OriginalFileReader;
    });

    describe("blobToBase64", () => {
        test("resolves with base64 payload and strips data URL prefix", async () => {
            const reader = new (global as any).FileReader() as MockFileReader;
            // Hijack the instance created inside the function by replacing the prototype method
            const readSpy = jest.spyOn((global as any).FileReader.prototype as any, "readAsDataURL").mockImplementation(function (this: MockFileReader, _b: Blob) {
                this.result = "data:audio/wav;base64,QUJD"; // "ABC"
                this.onloadend && this.onloadend.call(this as any, {} as any);
            });

            const blob = new Blob([Uint8Array.from([0, 1, 2])], { type: "audio/wav" });
            const base64 = await blobToBase64(blob);
            expect(base64).toBe("QUJD");
            expect(readSpy).toHaveBeenCalled();
            readSpy.mockRestore();
        });

        test("rejects when FileReader errors", async () => {
            const error = new Error("read error");
            const readSpy = jest.spyOn((global as any).FileReader.prototype as any, "readAsDataURL").mockImplementation(function (this: MockFileReader, _b: Blob) {
                this.onerror && this.onerror.call(this as any, error as any);
            });

            const blob = new Blob([Uint8Array.from([3, 4, 5])], { type: "audio/wav" });
            await expect(blobToBase64(blob)).rejects.toBe(error);
            readSpy.mockRestore();
        });
    });

    describe("resampleAudio", () => {
        test("downsamples by linear interpolation (16000 -> 8000)", () => {
            const src = new (global as any).AudioBuffer({ length: 4, numberOfChannels: 1, sampleRate: 16000 }) as MockAudioBuffer;
            const ch0 = src.getChannelData(0);
            ch0.set([0, 0.5, 1.0, -1.0]);

            const resampled = resampleAudio(src as unknown as AudioBuffer, 8000);
            expect(resampled.sampleRate).toBe(8000);
            expect(resampled.length).toBe(2); // floor(4 / (16000/8000)) = 2
            const out = resampled.getChannelData(0);
            // With ratio=2, indices sampled at 0 and 2
            expect(Array.from(out)).toEqual([0, 1]);
        });

        test("preserves number of channels and resamples each channel", () => {
            const src = new (global as any).AudioBuffer({ length: 6, numberOfChannels: 2, sampleRate: 24000 }) as MockAudioBuffer;
            src.getChannelData(0).set([0, 1, 2, 3, 4, 5]);
            src.getChannelData(1).set([5, 4, 3, 2, 1, 0]);

            const resampled = resampleAudio(src as unknown as AudioBuffer, 12000);
            expect(resampled.numberOfChannels).toBe(2);
            expect(resampled.length).toBe(3); // floor(6 / (24000/12000)) = 3
            expect(Array.from(resampled.getChannelData(0))).toEqual([0, 2, 4]);
            expect(Array.from(resampled.getChannelData(1))).toEqual([5, 3, 1]);
        });

        test("clamps sourceIndexCeil at last sample (boundary case)", () => {
            // ratio = 10000/8000 = 1.25; targetLength = floor(5/1.25)=4
            const src = new (global as any).AudioBuffer({ length: 5, numberOfChannels: 1, sampleRate: 10000 }) as MockAudioBuffer;
            // Simple ramp to make interpolation deterministic
            src.getChannelData(0).set([0, 1, 2, 3, 4]);
            const resampled = resampleAudio(src as unknown as AudioBuffer, 8000);
            expect(resampled.length).toBe(4);
            const out = Array.from(resampled.getChannelData(0));
            // Expected samples at indices i*1.25
            // i=0 -> 0, i=1 -> 1.25 -> 1 + 0.25*(2-1)=1.25, i=2 -> 2.5 -> 2 + 0.5*(3-2)=2.5
            // i=3 -> 3.75 -> 3 + 0.75*(4-3)=3.75 (ceil clamped to last index=4)
            expect(out.map(v => Number(v.toFixed(2)))).toEqual([0.00, 1.25, 2.50, 3.75]);
        });
    });

    describe("convertAudioBufferToWav", () => {
        test("creates a valid 16-bit PCM WAV header and data", () => {
            const src = new (global as any).AudioBuffer({ length: 4, numberOfChannels: 1, sampleRate: 16000 }) as MockAudioBuffer;
            // With ratio=2, resampled indices are 0 and 2 → values 0 and 1.0
            src.getChannelData(0).set([0, 0.25, 1.0, -1.0]);

            const wav = convertAudioBufferToWav(src as unknown as AudioBuffer, 8000);
            const view = new DataView(wav);

            // Chunk IDs
            const str = (off: number, len: number) => String.fromCharCode(...Array.from({ length: len }, (_, i) => view.getUint8(off + i)));
            expect(str(0, 4)).toBe("RIFF");
            expect(str(8, 4)).toBe("WAVE");
            expect(str(12, 4)).toBe("fmt ");
            expect(str(36, 4)).toBe("data");

            // Basic fmt
            expect(view.getUint16(20, true)).toBe(1); // PCM
            expect(view.getUint16(22, true)).toBe(1); // channels
            expect(view.getUint32(24, true)).toBe(8000); // sample rate
            expect(view.getUint16(34, true)).toBe(16); // bits per sample

            // Data size and total size
            const dataLen = view.getUint32(40, true);
            expect(dataLen).toBe(2 * 1 * 2); // resampled length=2, channels=1, bytes per sample=2
            expect((wav as ArrayBuffer).byteLength).toBe(44 + dataLen);

            // Samples start at offset 44
            expect(view.getInt16(44, true)).toBe(0); // 0 -> 0
            expect(view.getInt16(46, true)).toBe(0x7fff); // 1.0 -> 32767
        });

        test("encodes negative sample to signed 16-bit PCM", () => {
            const src = new (global as any).AudioBuffer({ length: 4, numberOfChannels: 1, sampleRate: 16000 }) as MockAudioBuffer;
            // With ratio=2, indices 0 and 2 → values 0 and -1.0
            src.getChannelData(0).set([0, 0.25, -1.0, 0.75]);

            const wav = convertAudioBufferToWav(src as unknown as AudioBuffer, 8000);
            const view = new DataView(wav);
            expect(view.getInt16(44, true)).toBe(0);
            expect(view.getInt16(46, true)).toBe(-32768);
        });
    });

    describe("writeString", () => {
        test("writes ASCII into DataView", () => {
            const buf = new ArrayBuffer(8);
            const dv = new DataView(buf);
            writeString(dv, 2, "AB");
            expect(String.fromCharCode(dv.getUint8(2))).toBe("A");
            expect(String.fromCharCode(dv.getUint8(3))).toBe("B");
        });
    });
});


