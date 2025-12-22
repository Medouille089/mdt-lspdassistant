(function () {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        const btn = document.getElementById('backlinkBtn');
        if (!btn) return;

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            window.location.href = '/menu-superviseur';
        });
    }
})();

document.getElementById('openExternal').onclick = function () {
    window.open('https://docs.google.com/spreadsheets/d/1hcanB99NBnLcQfO4BkCkQOfBVffdFFxJEYWF-Gb2m4M/edit?gid=0#gid=0&fvid=1716173874', '_blank');
};
