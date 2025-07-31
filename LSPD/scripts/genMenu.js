document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('.send-button').forEach(btn => {
        if (btn.getAttribute('href') === '#') {
            btn.remove();
        }
    });
});