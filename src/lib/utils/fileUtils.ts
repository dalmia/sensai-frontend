export const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onloadend = () => {
            const base64File = reader.result as string;
            const base64Data = base64File.split(',')[1];
            resolve(base64Data);
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };
    });
};


export const base64ToBlob = (base64Data: string, contentType: string): Blob => {
    const binaryData = atob(base64Data);
    const arrayBuffer = new ArrayBuffer(binaryData.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < binaryData.length; i++) {
        uint8Array[i] = binaryData.charCodeAt(i);
    }
    return new Blob([uint8Array], { type: contentType });
};

export const uploadFile = async (
    base64Data: string,
    filename: string,
    contentType: string
): Promise<string> => {
    let presigned_url = '';
    let file_uuid = '';

    try {
        // First, get a presigned URL for the file
        const presignedUrlResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/file/presigned-url/create`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content_type: contentType
            })
        });

        if (!presignedUrlResponse.ok) {
            throw new Error('Failed to get presigned URL');
        }

        const presignedData = await presignedUrlResponse.json();
        presigned_url = presignedData.presigned_url;
        file_uuid = presignedData.file_uuid;
    } catch (error) {
        console.error("Error getting presigned URL:", error);
    }

    // Convert base64 data to a Blob
    const dataBlob = base64ToBlob(base64Data, contentType);

    if (!presigned_url) {
        // If we couldn't get a presigned URL, try direct upload to the backend
        try {
            // Create FormData for the file upload
            const formData = new FormData();
            formData.append('file', dataBlob, filename);
            formData.append('content_type', contentType);

            // Upload directly to the backend
            const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/file/upload-local`, {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                throw new Error(`Failed to upload file to backend: ${uploadResponse.status}`);
            }

            const uploadData = await uploadResponse.json();
            file_uuid = uploadData.file_uuid;
        } catch (error) {
            console.error('Error with direct upload to backend:', error);
            throw new Error('Error with direct upload to backend');
        }
    } else {
        // Upload the file to S3 using the presigned URL
        try {
            const uploadResponse = await fetch(presigned_url, {
                method: 'PUT',
                body: dataBlob,
                headers: {
                    'Content-Type': contentType
                }
            });

            if (!uploadResponse.ok) {
                throw new Error(`Failed to upload file to S3: ${uploadResponse.status}`);
            }
        } catch (error) {
            console.error('Error uploading file to S3:', error);
            throw new Error('Error uploading file to S3');
        }
    }

    if (!file_uuid) {
        throw new Error('Failed to get file UUID after upload');
    }

    return file_uuid;
};

export const downloadFile = async (
    fileUuid: string,
    fileName: string,
    defaultExtension: string = 'zip'
): Promise<void> => {
    try {
        // Get file extension from filename, fallback to defaultExtension
        const fileExtension = fileName.split('.').pop()?.toLowerCase() || defaultExtension;

        // Try to get presigned URL first
        const presignedResponse = await fetch(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}/file/presigned-url/get?uuid=${fileUuid}&file_extension=${fileExtension}`,
            { method: 'GET' }
        );

        let downloadUrl: string;
        if (presignedResponse.ok) {
            const { url } = await presignedResponse.json();
            downloadUrl = url;
        } else {
            // Fallback to direct download
            downloadUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/file/download-local/?uuid=${fileUuid}&file_extension=${fileExtension}`;
        }

        // Fetch the file as a blob to have control over the filename
        const fileResponse = await fetch(downloadUrl);
        if (!fileResponse.ok) {
            throw new Error('Failed to download file');
        }

        const blob = await fileResponse.blob();
        const blobUrl = URL.createObjectURL(blob);

        // Create a temporary link and trigger download with the correct filename
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the object URL
        URL.revokeObjectURL(blobUrl);
    } catch (error) {
        console.error('Error downloading file:', error);
        throw error;
    }
};
