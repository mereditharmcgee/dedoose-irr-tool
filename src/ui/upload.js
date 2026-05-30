// Drop zone: accepts 2 or 3 .docx files via drag/drop or click-to-browse and
// hands the File list back to the caller.

export function createDropZone(zoneEl, inputEl, onFiles) {
  const browse = () => inputEl.click();

  zoneEl.addEventListener('click', browse);
  zoneEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      browse();
    }
  });

  inputEl.addEventListener('change', () => {
    if (inputEl.files.length) handle([...inputEl.files]);
    inputEl.value = ''; // allow re-selecting the same files
  });

  ['dragenter', 'dragover'].forEach((evt) =>
    zoneEl.addEventListener(evt, (e) => {
      e.preventDefault();
      zoneEl.classList.add('dragover');
    })
  );
  ['dragleave', 'dragend', 'drop'].forEach((evt) =>
    zoneEl.addEventListener(evt, (e) => {
      e.preventDefault();
      if (evt === 'dragleave' && zoneEl.contains(e.relatedTarget)) return;
      zoneEl.classList.remove('dragover');
    })
  );

  zoneEl.addEventListener('drop', (e) => {
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) handle(files);
  });

  function handle(files) {
    const docx = files.filter((f) => f.name.toLowerCase().endsWith('.docx'));
    onFiles(docx, files.length);
  }
}
