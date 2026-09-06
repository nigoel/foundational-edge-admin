// ---- Supabase: same project as the public site. No login here (see security banner) —
// every RPC below is callable by anyone with this anon key, same as the public site's. ----
var SUPABASE_URL = 'https://wwmbpgtddsyettfdakbe.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3bWJwZ3RkZHN5ZXR0ZmRha2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NjA4MDksImV4cCI6MjA5OTMzNjgwOX0.owfmZtMW83G3HGW69ofbSbisRBMHgK7AX7QpSl-xRO8';
var PUBLIC_SITE_URL = 'https://foundational-edge.niting-goel.workers.dev';
var STORAGE_BASE = SUPABASE_URL + '/storage/v1/object/public/question-images';

var RPC = {
  listQuizzes: SUPABASE_URL + '/rest/v1/rpc/admin_list_quizzes',
  createQuiz: SUPABASE_URL + '/rest/v1/rpc/admin_create_quiz',
  expireQuiz: SUPABASE_URL + '/rest/v1/rpc/admin_expire_quiz',
  getQuestions: SUPABASE_URL + '/rest/v1/rpc/admin_get_questions',
  bulkInsertQuestions: SUPABASE_URL + '/rest/v1/rpc/admin_bulk_insert_questions',
  setQuestionImage: SUPABASE_URL + '/rest/v1/rpc/admin_set_question_image'
};

function supabaseRpc(url, body){
  return fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }).then(function(res){
    if(!res.ok) return res.text().then(function(t){ throw new Error('request failed: ' + res.status + ' ' + t); });
    return res.json();
  });
}

var QUIZ_TYPES = [
  { key: 'Free-Skill-Test', label: 'Free Skill Test' },
  { key: 'Weekly-Practice', label: 'Weekly Practice' },
  { key: 'Monthly-Competition', label: 'Monthly Competition' }
];

var currentGrade = '4';
var currentQuizzes = []; // last-loaded list for currentGrade

// =====================================================================
// GRADE TABS
// =====================================================================
function renderGradeTabs(){
  var bar = document.getElementById('gradeTabs');
  bar.innerHTML = '';
  ['3','4','5','6','7','8'].forEach(function(g){
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'grade-tab' + (g === currentGrade ? ' active' : '');
    btn.textContent = 'Grade ' + g;
    btn.addEventListener('click', function(){
      currentGrade = g;
      renderGradeTabs();
      loadQuizzes();
    });
    bar.appendChild(btn);
  });
}

// =====================================================================
// QUIZ LIST
// =====================================================================
function quizStatus(quiz){
  if(!quiz.active) return { label: 'Retired', cls: 'retired' };
  if(quiz.expiry_date){
    var today = new Date().toISOString().slice(0, 10);
    if(quiz.expiry_date < today) return { label: 'Expired', cls: 'expired' };
  }
  return { label: 'Active', cls: 'active' };
}

function formatDate(s){
  if(!s) return '—';
  try {
    return new Date(s + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch(e){ return s; }
}

function shortId(id){
  return id ? id.slice(0, 8) : '';
}

function previewUrl(quiz){
  return PUBLIC_SITE_URL + '/skill-check.html?grade=' + encodeURIComponent(quiz.grade) + '&previewQuizId=' + encodeURIComponent(quiz.id);
}

function loadQuizzes(){
  document.getElementById('quizSections').innerHTML = '';
  document.getElementById('listLoading').style.display = '';

  supabaseRpc(RPC.listQuizzes, { p_grade: currentGrade }).then(function(rows){
    currentQuizzes = rows || [];
    renderQuizSections(currentQuizzes);
    document.getElementById('listLoading').style.display = 'none';
  }).catch(function(err){
    console.error(err);
    document.getElementById('listLoading').textContent = 'Something went wrong loading quizzes. Check the console and try refreshing.';
  });
}

function renderQuizSections(quizzes){
  var container = document.getElementById('quizSections');
  container.innerHTML = '';

  QUIZ_TYPES.forEach(function(type){
    var matching = quizzes.filter(function(q){ return q.quiz_type === type.key; });

    var section = document.createElement('div');
    section.className = 'quiz-type-section';

    var heading = document.createElement('div');
    heading.className = 'quiz-type-heading';
    heading.innerHTML = '<span>' + type.label + '</span><span class="quiz-type-count">' + matching.length + '</span>';
    section.appendChild(heading);

    if(matching.length === 0){
      var empty = document.createElement('div');
      empty.className = 'quiz-empty-note';
      empty.textContent = 'No ' + type.label.toLowerCase() + ' quizzes for Grade ' + currentGrade + ' yet.';
      section.appendChild(empty);
    } else {
      matching.forEach(function(quiz){
        section.appendChild(renderQuizCard(quiz));
      });
    }

    container.appendChild(section);
  });
}

function renderQuizCard(quiz){
  var status = quizStatus(quiz);

  var card = document.createElement('div');
  card.className = 'quiz-card' + (status.cls === 'retired' ? ' inactive' : '');

  var main = document.createElement('div');
  main.className = 'quiz-card-main';

  var title = document.createElement('div');
  title.className = 'quiz-card-title';
  title.textContent = quiz.title || ('Untitled — Grade ' + quiz.grade + ' ' + quiz.quiz_type);
  main.appendChild(title);

  var meta = document.createElement('div');
  meta.className = 'quiz-card-meta';
  meta.innerHTML =
    '<span class="mono">' + shortId(quiz.id) + '…</span>' +
    '<span>Published ' + formatDate(quiz.publish_date) + '</span>' +
    (quiz.expiry_date ? '<span>Expires ' + formatDate(quiz.expiry_date) + '</span>' : '<span>No expiry</span>') +
    '<span>' + quiz.question_count + ' question' + (quiz.question_count === 1 ? '' : 's') + '</span>' +
    '<span>Max ' + quiz.max_attempts + ' attempt' + (quiz.max_attempts === 1 ? '' : 's') + '</span>';
  main.appendChild(meta);

  var statusPill = document.createElement('span');
  statusPill.className = 'status-pill ' + status.cls;
  statusPill.textContent = status.label;
  statusPill.style.marginTop = '6px';
  statusPill.style.display = 'inline-block';
  main.appendChild(statusPill);

  card.appendChild(main);

  var actions = document.createElement('div');
  actions.className = 'quiz-card-actions';

  var previewBtn = document.createElement('a');
  previewBtn.href = previewUrl(quiz);
  previewBtn.target = '_blank';
  previewBtn.rel = 'noopener';
  previewBtn.className = 'btn btn-ghost btn-sm';
  previewBtn.textContent = 'Preview';
  actions.appendChild(previewBtn);

  var csvBtn = document.createElement('button');
  csvBtn.type = 'button';
  csvBtn.className = 'btn btn-ghost btn-sm';
  csvBtn.textContent = 'CSV';
  csvBtn.addEventListener('click', function(){ downloadQuestionsCsv(quiz); });
  actions.appendChild(csvBtn);

  var manageBtn = document.createElement('button');
  manageBtn.type = 'button';
  manageBtn.className = 'btn btn-primary btn-sm';
  manageBtn.textContent = 'Manage questions';
  manageBtn.addEventListener('click', function(){ showDetailScreen(quiz); });
  actions.appendChild(manageBtn);

  if(status.cls !== 'retired'){
    var expireBtn = document.createElement('button');
    expireBtn.type = 'button';
    expireBtn.className = 'btn btn-danger btn-sm';
    expireBtn.textContent = 'Expire';
    expireBtn.addEventListener('click', function(){ expireQuiz(quiz); });
    actions.appendChild(expireBtn);
  }

  card.appendChild(actions);
  return card;
}

function expireQuiz(quiz){
  if(!window.confirm('Retire "' + (quiz.title || quiz.id) + '"? Students will no longer be shown this quiz, but past attempts stay reviewable.')) return;
  supabaseRpc(RPC.expireQuiz, { p_quiz_id: quiz.id }).then(function(){
    loadQuizzes();
  }).catch(function(err){
    console.error(err);
    window.alert('Something went wrong retiring this quiz. Check the console.');
  });
}

// =====================================================================
// CSV EXPORT
// =====================================================================
function csvEscape(val){
  var s = (val === null || val === undefined) ? '' : String(val);
  if(/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function questionsToCsv(questions){
  var headers = ['order_num', 'section', 'difficulty', 'question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer', 'explanation', 'image_url', 'active'];
  var lines = [headers.join(',')];
  questions.forEach(function(q){
    lines.push(headers.map(function(h){ return csvEscape(q[h]); }).join(','));
  });
  return lines.join('\r\n');
}

function downloadQuestionsCsv(quiz){
  supabaseRpc(RPC.getQuestions, { p_quiz_id: quiz.id }).then(function(rows){
    var csv = questionsToCsv(rows || []);
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'questions-' + (quiz.title || quiz.id).replace(/[^a-z0-9]+/gi, '_') + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }).catch(function(err){
    console.error(err);
    window.alert('Something went wrong generating the CSV. Check the console.');
  });
}

// =====================================================================
// NEW QUIZ MODAL
// =====================================================================
function openNewQuizModal(){
  document.getElementById('newQuizForm').reset();
  document.getElementById('nqGrade').value = currentGrade;
  document.getElementById('nqPublishDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('newQuizError').style.display = 'none';
  document.getElementById('newQuizModal').classList.add('open');
}
function closeNewQuizModal(){
  document.getElementById('newQuizModal').classList.remove('open');
}

document.getElementById('newQuizBtn').addEventListener('click', openNewQuizModal);
document.getElementById('newQuizCloseBtn').addEventListener('click', closeNewQuizModal);
document.getElementById('newQuizCancelBtn').addEventListener('click', closeNewQuizModal);
document.getElementById('newQuizModal').addEventListener('click', function(e){
  if(e.target === this) closeNewQuizModal();
});

document.getElementById('newQuizForm').addEventListener('submit', function(e){
  e.preventDefault();
  var errEl = document.getElementById('newQuizError');
  errEl.style.display = 'none';

  var grade = document.getElementById('nqGrade').value;
  var quizType = document.getElementById('nqType').value;
  var skill = document.getElementById('nqSkill').value;
  var maxAttempts = parseInt(document.getElementById('nqMaxAttempts').value, 10);
  var publishDate = document.getElementById('nqPublishDate').value;
  var expiryDate = document.getElementById('nqExpiryDate').value || null;
  var title = document.getElementById('nqTitle').value || null;

  if(!maxAttempts || maxAttempts < 1){
    errEl.textContent = 'Max attempts must be at least 1.';
    errEl.style.display = '';
    return;
  }

  var btn = document.getElementById('newQuizSubmitBtn');
  btn.disabled = true; btn.textContent = 'Creating…';

  supabaseRpc(RPC.createQuiz, {
    p_quiz_type: quizType,
    p_grade: grade,
    p_skill: skill,
    p_max_attempts: maxAttempts,
    p_publish_date: publishDate,
    p_expiry_date: expiryDate,
    p_title: title
  }).then(function(rows){
    var row = rows && rows[0];
    if(!row || !row.id) throw new Error('no id returned');
    closeNewQuizModal();
    currentGrade = grade;
    renderGradeTabs();
    // Jump straight into managing the new quiz's questions — that's the natural next step.
    showDetailScreen({
      id: row.id, grade: grade, quiz_type: quizType, skill: skill,
      max_attempts: maxAttempts, publish_date: publishDate, expiry_date: expiryDate,
      title: title, active: true
    });
    loadQuizzes(); // refresh the list in the background so it's current when they go back
  }).catch(function(err){
    console.error(err);
    errEl.textContent = 'Something went wrong creating the quiz. Check the console and try again.';
    errEl.style.display = '';
  }).finally(function(){
    btn.disabled = false; btn.textContent = 'Create quiz →';
  });
});

// =====================================================================
// DETAIL SCREEN (manage one quiz's questions)
// =====================================================================
var currentQuiz = null;

function showDetailScreen(quiz){
  currentQuiz = quiz;
  document.getElementById('listScreen').style.display = 'none';
  document.getElementById('detailScreen').style.display = '';

  document.getElementById('detailTitle').textContent = quiz.title || ('Grade ' + quiz.grade + ' ' + quiz.quiz_type);
  document.getElementById('detailMeta').textContent =
    'Grade ' + quiz.grade + ' · ' + quiz.quiz_type + ' · Published ' + formatDate(quiz.publish_date) +
    (quiz.expiry_date ? ' · Expires ' + formatDate(quiz.expiry_date) : '') + ' · Max ' + quiz.max_attempts + ' attempts';
  document.getElementById('detailPreviewLink').href = previewUrl(quiz);
  document.getElementById('detailStoragePath').textContent = 'Quiz/' + quiz.id + '/';
  document.getElementById('uploadStatus').textContent = '';
  document.getElementById('uploadStatus').className = 'upload-status';
  document.getElementById('excelInput').value = '';

  loadQuestions();
}

document.getElementById('detailBackLink').addEventListener('click', function(e){
  e.preventDefault();
  document.getElementById('detailScreen').style.display = 'none';
  document.getElementById('listScreen').style.display = '';
  loadQuizzes();
});

document.getElementById('detailCsvBtn').addEventListener('click', function(){
  if(currentQuiz) downloadQuestionsCsv(currentQuiz);
});

document.getElementById('detailExpireBtn').addEventListener('click', function(){
  if(!currentQuiz) return;
  expireQuiz(currentQuiz);
  document.getElementById('detailScreen').style.display = 'none';
  document.getElementById('listScreen').style.display = '';
});

function loadQuestions(){
  document.getElementById('questionsTableBody').innerHTML = '';
  document.getElementById('questionsEmpty').style.display = 'none';
  document.getElementById('detailLoading').style.display = '';

  supabaseRpc(RPC.getQuestions, { p_quiz_id: currentQuiz.id }).then(function(rows){
    document.getElementById('detailLoading').style.display = 'none';
    if(!rows || rows.length === 0){
      document.getElementById('questionsEmpty').style.display = '';
      return;
    }
    renderQuestionsTable(rows);
  }).catch(function(err){
    console.error(err);
    document.getElementById('detailLoading').textContent = 'Something went wrong loading questions. Check the console.';
  });
}

function renderQuestionsTable(questions){
  var tbody = document.getElementById('questionsTableBody');
  tbody.innerHTML = '';

  questions.forEach(function(q){
    var tr = document.createElement('tr');

    var tdNum = document.createElement('td');
    tdNum.textContent = q.order_num;
    tr.appendChild(tdNum);

    var tdSection = document.createElement('td');
    tdSection.textContent = q.section || '';
    tr.appendChild(tdSection);

    var tdText = document.createElement('td');
    tdText.className = 'q-text-cell';
    tdText.textContent = q.question_text;
    tr.appendChild(tdText);

    var tdCorrect = document.createElement('td');
    tdCorrect.textContent = q.correct_answer;
    tr.appendChild(tdCorrect);

    var tdImg = document.createElement('td');
    var imgSpan = document.createElement('span');
    imgSpan.className = 'img-status ' + (q.image_url ? 'present' : 'missing');
    imgSpan.textContent = q.image_url ? 'Set' : 'None';
    tdImg.appendChild(imgSpan);
    tr.appendChild(tdImg);

    var tdActive = document.createElement('td');
    tdActive.textContent = q.active ? 'Yes' : 'No';
    tr.appendChild(tdActive);

    var tdActions = document.createElement('td');
    var setImgBtn = document.createElement('button');
    setImgBtn.type = 'button';
    setImgBtn.className = 'btn btn-ghost btn-sm';
    setImgBtn.textContent = 'Set image';
    setImgBtn.addEventListener('click', function(){ promptSetImage(q); });
    tdActions.appendChild(setImgBtn);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });
}

function promptSetImage(question){
  var current = question.image_url ? question.image_url.split('/').pop() : '';
  var filename = window.prompt(
    'Filename uploaded to Quiz/' + currentQuiz.id + '/ (leave blank to remove the image):',
    current
  );
  if(filename === null) return; // cancelled

  var newUrl = filename.trim() ? (STORAGE_BASE + '/Quiz/' + currentQuiz.id + '/' + filename.trim()) : '';

  supabaseRpc(RPC.setQuestionImage, { p_question_id: question.id, p_image_url: newUrl }).then(function(){
    loadQuestions();
  }).catch(function(err){
    console.error(err);
    window.alert('Something went wrong saving the image. Check the console.');
  });
}

// =====================================================================
// EXCEL UPLOAD
// =====================================================================
var EXCEL_COLUMNS = ['section', 'difficulty', 'order_num', 'question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer', 'explanation', 'image_filename'];
var REQUIRED_COLUMNS = ['section', 'order_num', 'question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer'];

// Exposed as a standalone, pure function so it can be unit tested without touching the DOM.
function parseExcelRows(rawRows){
  var errors = [];
  var questions = [];

  rawRows.forEach(function(row, idx){
    var rowNum = idx + 2; // header is row 1
    var missing = REQUIRED_COLUMNS.filter(function(c){ return row[c] === undefined || row[c] === null || row[c] === ''; });
    if(missing.length > 0){
      errors.push('Row ' + rowNum + ': missing ' + missing.join(', '));
      return;
    }

    var correct = String(row.correct_answer).trim().toUpperCase();
    if(['A', 'B', 'C', 'D'].indexOf(correct) === -1){
      errors.push('Row ' + rowNum + ': correct_answer must be A, B, C, or D (got "' + row.correct_answer + '")');
      return;
    }

    var orderNum = parseInt(row.order_num, 10);
    if(isNaN(orderNum)){
      errors.push('Row ' + rowNum + ': order_num must be a number (got "' + row.order_num + '")');
      return;
    }

    questions.push({
      section: String(row.section).trim(),
      difficulty: row.difficulty ? String(row.difficulty).trim() : null,
      order_num: orderNum,
      question_text: String(row.question_text).trim(),
      option_a: String(row.option_a).trim(),
      option_b: String(row.option_b).trim(),
      option_c: String(row.option_c).trim(),
      option_d: String(row.option_d).trim(),
      correct_answer: correct,
      explanation: row.explanation ? String(row.explanation).trim() : null,
      image_filename: row.image_filename ? String(row.image_filename).trim() : null
    });
  });

  return { questions: questions, errors: errors };
}

function buildImageUrl(quizId, filename){
  if(!filename) return null;
  return STORAGE_BASE + '/Quiz/' + quizId + '/' + filename;
}

document.getElementById('excelInput').addEventListener('change', function(e){
  var file = e.target.files[0];
  if(!file) return;

  var statusEl = document.getElementById('uploadStatus');
  statusEl.className = 'upload-status';
  statusEl.textContent = 'Reading file…';

  var reader = new FileReader();
  reader.onload = function(evt){
    try {
      var data = new Uint8Array(evt.target.result);
      var workbook = XLSX.read(data, { type: 'array' });
      var firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      var rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      var parsed = parseExcelRows(rawRows);

      if(parsed.errors.length > 0){
        statusEl.className = 'upload-status error';
        statusEl.textContent = parsed.errors.length + ' row(s) had problems and were skipped: ' + parsed.errors.slice(0, 5).join(' · ') + (parsed.errors.length > 5 ? ' …' : '');
      }

      if(parsed.questions.length === 0){
        statusEl.className = 'upload-status error';
        statusEl.textContent = (statusEl.textContent ? statusEl.textContent + ' ' : '') + 'No valid rows found — nothing was uploaded.';
        return;
      }

      var payload = parsed.questions.map(function(q){
        return {
          section: q.section,
          difficulty: q.difficulty,
          order_num: q.order_num,
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          image_url: buildImageUrl(currentQuiz.id, q.image_filename)
        };
      });

      statusEl.className = 'upload-status';
      statusEl.textContent = 'Uploading ' + payload.length + ' question(s)…';

      supabaseRpc(RPC.bulkInsertQuestions, { p_quiz_id: currentQuiz.id, p_questions: payload }).then(function(rows){
        var inserted = rows && rows[0] ? rows[0].inserted_count : payload.length;
        statusEl.className = 'upload-status success';
        statusEl.textContent = 'Added ' + inserted + ' question(s).' + (parsed.errors.length > 0 ? ' (' + parsed.errors.length + ' row(s) skipped — see above.)' : '');
        loadQuestions();
      }).catch(function(err){
        console.error(err);
        statusEl.className = 'upload-status error';
        statusEl.textContent = 'Something went wrong saving the questions. Check the console.';
      });
    } catch(err){
      console.error(err);
      statusEl.className = 'upload-status error';
      statusEl.textContent = "Couldn't read that file — make sure it's a valid .xlsx/.xls file.";
    }
  };
  reader.readAsArrayBuffer(file);
});

// =====================================================================
// INIT
// =====================================================================
renderGradeTabs();
loadQuizzes();
