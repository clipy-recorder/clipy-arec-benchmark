const pointer = document.querySelector('#capture-pointer');
const note = document.querySelector('#capture-note');
const params = new URLSearchParams(window.location.search);

if (params.get('capture') === '1') document.body.classList.add('capture-mode');

window.moveCapturePointer = (x, y) => {
  pointer.style.left = `${x}px`;
  pointer.style.top = `${y}px`;
};

window.setCapturePointerMode = (mode) => {
  pointer.dataset.mode = mode;
};

window.showCaptureNote = (text, x, y) => {
  note.textContent = text;
  note.style.left = `${x}px`;
  note.style.top = `${y}px`;
  note.dataset.visible = 'true';
};

window.hideCaptureNote = () => {
  note.dataset.visible = 'false';
};
