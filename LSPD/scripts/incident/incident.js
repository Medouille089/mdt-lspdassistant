function previewSignature(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('signaturePreview');
    preview.innerHTML = '';

    if (file && file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.onload = () => URL.revokeObjectURL(img.src);
        preview.appendChild(img);
    } else {
        preview.innerText = "Fichier non valide.";
    }
}

function previewAttachments(event) {
    const files = event.target.files;
    const preview = document.getElementById('attachmentsPreview');
    preview.innerHTML = '';

    Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.onload = () => URL.revokeObjectURL(img.src);
            preview.appendChild(img);
        }
    });
}