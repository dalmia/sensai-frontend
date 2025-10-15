// Helper function to convert Blob to base64
export const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            // Extract the base64 data portion (remove "data:audio/wav;base64," prefix)
            const base64Data = base64String.split(',')[1];
            resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

// Helper function to resample audio data to a target sample rate
export const resampleAudio = (audioBuffer: AudioBuffer, targetSampleRate: number = 8000): AudioBuffer => {
    const sourceSampleRate = audioBuffer.sampleRate;
    const numChannels = audioBuffer.numberOfChannels;
    const sourceLength = audioBuffer.length;

    // Calculate the target length based on the sample rate ratio
    const ratio = sourceSampleRate / targetSampleRate;
    const targetLength = Math.floor(sourceLength / ratio);

    // Create new audio buffer with target sample rate
    const resampledBuffer = new AudioBuffer({
        length: targetLength,
        numberOfChannels: numChannels,
        sampleRate: targetSampleRate
    });

    // Resample each channel
    for (let channel = 0; channel < numChannels; channel++) {
        const sourceChannel = audioBuffer.getChannelData(channel);
        const targetChannel = resampledBuffer.getChannelData(channel);

        // Simple linear interpolation resampling
        for (let i = 0; i < targetLength; i++) {
            const sourceIndex = i * ratio;
            const sourceIndexFloor = Math.floor(sourceIndex);
            const sourceIndexCeil = Math.min(sourceIndexFloor + 1, sourceLength - 1);
            const fraction = sourceIndex - sourceIndexFloor;

            // Linear interpolation
            const sample = sourceChannel[sourceIndexFloor] * (1 - fraction) +
                sourceChannel[sourceIndexCeil] * fraction;
            targetChannel[i] = sample;
        }
    }

    return resampledBuffer;
};

// Helper function to write strings to DataView
export const writeString = (view: DataView, offset: number, string: string): void => {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
};

// Helper function to convert AudioBuffer to WAV format
export const convertAudioBufferToWav = (audioBuffer: AudioBuffer, targetSampleRate: number = 8000): ArrayBuffer => {
    // Resample audio to target sample rate
    const resampledBuffer = resampleAudio(audioBuffer, targetSampleRate);

    const numOfChan = resampledBuffer.numberOfChannels;
    const length = resampledBuffer.length * numOfChan * 2;
    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);
    const sampleRate = targetSampleRate;
    const channels: Float32Array[] = [];

    // Extract channels from resampled buffer
    for (let i = 0; i < numOfChan; i++) {
        channels.push(resampledBuffer.getChannelData(i));
    }

    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // File length
    view.setUint32(4, 36 + length, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // Format chunk identifier
    writeString(view, 12, 'fmt ');
    // Format chunk length
    view.setUint32(16, 16, true);
    // Sample format (raw)
    view.setUint16(20, 1, true);
    // Channel count
    view.setUint16(22, numOfChan, true);
    // Sample rate
    view.setUint32(24, sampleRate, true);
    // Byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * numOfChan * 2, true);
    // Block align (channel count * bytes per sample)
    view.setUint16(32, numOfChan * 2, true);
    // Bits per sample
    view.setUint16(34, 16, true);
    // Data chunk identifier
    writeString(view, 36, 'data');
    // Data chunk length
    view.setUint32(40, length, true);

    // Write PCM samples from resampled buffer
    const offset = 44;
    let pos = 0;
    for (let i = 0; i < resampledBuffer.length; i++) {
        for (let channel = 0; channel < numOfChan; channel++) {
            // Clamp the value to -1.0 - 1.0 range and convert to 16-bit
            const sample = Math.max(-1, Math.min(1, channels[channel][i]));
            const value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset + pos, value, true);
            pos += 2;
        }
    }

    return buffer;
};
