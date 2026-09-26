/* 人大会计学/财务管理 期末题库 App 逻辑 */
(function () {
  "use strict";

  /* ================= 常量与数据 ================= */
  var LS_KEY = "ruc-quiz-progress-v1";
  var LS_SETTINGS = "ruc-quiz-settings-v1";
  var GIST_FILENAME = "ruc-quiz-progress.json";
  var GIST_DESC = "ruc-accounting-quiz-sync";
  var API = "https://api.github.com";
  var DATA = window.QUIZ_DATA;

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  /* ================= 存储 ================= */
  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(LS_SETTINGS)) || {}; }
    catch (e) { return {}; }
  }
  function saveSettings() {
    try { localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)); } catch (e) {}
  }
  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveLocal() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(progress)); } catch (e) {}
  }

  /* ================= 状态 ================= */
  var settings = loadSettings();
  var progress = loadLocal();
  var mode = "practice";     // practice | exam
  var subject = "会计学";
  var chapterId = "all";
  var favOnly = false;
  var queue = [];
  var idx = 0;
  var examAnswers = {};      // qid -> 答案（单选A-D / 判断"对错" / 简答文本）
  var reviewWrong = false;   // 交卷后是否只看错题
  var syncTimer = null;

  function rec(qid) {
    if (!progress[qid]) progress[qid] = {};
    return progress[qid];
  }

  /* ================= 队列构建 ================= */
  function subjectChapters() {
    var s = DATA.subjects.filter(function (x) { return x.id === subject; })[0];
    return s ? s.chapters : [];
  }
  function totalCount() {
    var n = 0;
    DATA.subjects.forEach(function (s) { s.chapters.forEach(function (c) { n += c.questions.length; }); });
    return n;
  }
  function buildQueue() {
    var chs = subjectChapters();
    if (chapterId !== "all") chs = chs.filter(function (c) { return c.id === chapterId; });
    var qs = [];
    chs.forEach(function (c) { c.questions.forEach(function (q) { qs.push(q); }); });
    if (favOnly) qs = qs.filter(function (q) { return rec(q.id).f; });
    if (mode === "exam" && examDone && reviewWrong) {
      qs = qs.filter(function (q) { return (examResult.wrong[q.id] === true); });
    }
    queue = qs;
    if (idx >= queue.length) idx = queue.length - 1;
    if (idx < 0) idx = 0;
  }

  /* ================= 渲染 ================= */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function sanitizeSvg(svg) {
    var div = document.createElement("div");
    div.innerHTML = String(svg);
    div.querySelectorAll("script, foreignObject, iframe, object, embed").forEach(function (n) { n.remove(); });
    var out = div.innerHTML;
    if (out.indexOf("<svg") === -1) return "";
    return out;
  }

  var typeName = { single: "单选题", judge: "判断题", essay: "简答/分录题" };
  var typeBadge = { single: "bg-blue", judge: "bg-green", essay: "bg-purple" };

  function optionLabel(i) { return String.fromCharCode(65 + i); }

  function currentQuestion() { return queue[idx]; }

  function renderQuestion() {
    var area = $("#questionArea");
    if (!queue.length) {
      area.innerHTML = '<div class="empty">' +
        (favOnly ? '还没有收藏的题目，做题时点 ⭐ 收藏即可' : '本章节暂无题目') + '</div>';
      $("#actionbar").style.display = "none";
      return;
    }
    $("#actionbar").style.display = "";
    var q = currentQuestion();
    var r = rec(q.id);
    var answered = isAnswered(q, r);
    var showResult = (mode === "practice" && r.done);
    var reveal = showResult || (mode === "exam" && examDone);
    var html = "";

    // 题头
    html += '<div class="q-head">' +
      '<span class="badge ' + typeBadge[q.type] + '">' + typeName[q.type] + '</span>' +
      '<span class="q-no">第 ' + (idx + 1) + ' / ' + queue.length + ' 题</span>' +
      '<span class="q-ch">' + esc(chapterTitleOf(q)) + '</span>' +
      '<button class="fav ' + (r.f ? "on" : "") + '" id="favBtn">' + (r.f ? "★ 已收藏" : "☆ 收藏") + '</button>' +
      '</div>';

    // 题干
    html += '<div class="stem">' + esc(q.stem).replace(/\n/g, "<br>") + '</div>';

    // 选项 / 判断 / 简答
    if (q.type === "single") {
      html += '<div class="options" id="options">';
      q.options.forEach(function (o, i) {
        var chosen = (mode === "practice" ? (r.c || "") : (examAnswers[q.id] || "")) === optionLabel(i);
        var cls = "opt" + (chosen ? " chosen" : "");
        if (reveal) {
          if (optionLabel(i) === q.answer) cls += " right";
          else if (chosen) cls += " wrong";
        }
        html += '<label class="' + cls + '"><input type="radio" name="opt" value="' + optionLabel(i) + '"' +
          (chosen ? " checked" : "") + (reveal ? " disabled" : "") + '>' +
          '<span class="opt-tag">' + optionLabel(i) + '</span><span class="opt-text">' + esc(o) + '</span></label>';
      });
      html += '</div>';
    } else if (q.type === "judge") {
      var chosen = mode === "practice" ? (r.c || "") : (examAnswers[q.id] || "");
      html += '<div class="options" id="options">';
      ["对", "错"].forEach(function (v) {
        var isChosen = chosen === v;
        var cls = "opt judge" + (isChosen ? " chosen" : "");
        if (reveal) {
          if (v === q.answer) cls += " right";
          else if (isChosen) cls += " wrong";
        }
        html += '<label class="' + cls + '"><input type="radio" name="opt" value="' + v + '"' +
          (isChosen ? " checked" : "") + (reveal ? " disabled" : "") + '>' +
          '<span class="opt-tag">' + (v === "对" ? "√" : "×") + '</span><span class="opt-text">' + v + '</span></label>';
      });
      html += '</div>';
    } else { // essay
      var draft = (mode === "practice" ? (r.d || "") : (examAnswers[q.id] || ""));
      if (reveal) {
        html += '<div class="essay-block">';
        html += '<div class="essay-user">你的作答：<div class="essay-text">' + esc(draft || "（未作答）").replace(/\n/g, "<br>") + '</div></div>';
        html += '<div class="ans-block"><div class="ans-title">参考答案</div><div class="ans-content">' +
          esc(q.answer).replace(/\n/g, "<br>") + '</div></div>';
        html += '</div>';
      } else {
        html += '<textarea id="essayInput" class="essay-input" placeholder="写下你的答案（分录逐笔写：借… 贷…；简答分点作答）…">' +
          esc(draft) + '</textarea>';
      }
      html += '<div class="essay-note">简答题为自评题型：练习模式下写完点「查看参考答案」自行对照打分。</div>';
    }

    // 解析区（练习模式做完后 / 考试交卷后）
    if (reveal) {
      var okTxt = "";
      if (q.type !== "essay") {
        var ok = (mode === "practice") ? r.ok : (examResult && examResult.grade[q.id]);
        if (mode === "exam" && !examResult) ok = false;
        okTxt = '<div class="verdict ' + (ok ? "v-ok" : "v-no") + '">' + (ok ? "✓ 回答正确" : "✗ 回答错误（正确答案：" + esc(q.answer) + "）") + '</div>';
      }
      html += '<div class="explain">' + okTxt +
        '<div class="ans-title">解析</div><div class="ans-content">' + esc(q.explanation).replace(/\n/g, "<br>") + '</div>';
      if (q.diagram) {
        html += '<div class="diagram-title">图解</div><div class="diagram">' + sanitizeSvg(q.diagram) + '</div>';
      }
      html += '</div>';
    }

    area.innerHTML = html;
    bindQuestionEvents(q);
    renderActions(q, r, showResult);
    updateStats();
  }

  function chapterTitleOf(q) {
    var m = /^(acc|fin)-ch(\d+)/.exec(q.id);
    if (!m) return "";
    var cid = m[0];
    var s = DATA.subjects.filter(function (x) {
      return (cid.indexOf("acc-") === 0 ? x.id === "会计学" : x.id === "财务管理");
    })[0];
    if (!s) return "";
    var ch = s.chapters.filter(function (c) { return c.id === cid; })[0];
    return ch ? ch.title.replace(/^第.+?章 /, "") : "";
  }

  function bindQuestionEvents(q) {
    var opts = $("#options");
    if (!opts) return;
    opts.addEventListener("change", function (e) {
      var t = e.target;
      if (!t.name || t.name !== "opt") return;
      if (mode === "practice") {
        rec(q.id).c = t.value;
        saveLocal(); scheduleSync();
      } else {
        examAnswers[q.id] = t.value;
        saveExamLocal();
      }
      updateStats();
    });
    var ea = $("#essayInput");
    if (ea) {
      ea.addEventListener("input", function () {
        if (mode === "practice") { rec(q.id).d = ea.value; saveLocal(); scheduleSync(); }
        else { examAnswers[q.id] = ea.value; saveExamLocal(); }
      });
    }
  }

  function isAnswered(q, r) {
    if (q.type === "essay") return !!(r && r.done);
    return !!(r && r.done);
  }

  function renderActions(q, r, showResult) {
    var bar = $("#actionbar");
    var html = "";
    html += '<button id="prevBtn" ' + (idx <= 0 ? "disabled" : "") + '>← 上一题</button>';
    if (mode === "practice") {
      if (q.type === "essay") {
        if (!showResult) {
          html += '<button id="revealBtn" class="primary">查看参考答案</button>';
        } else {
          html += '<button id="selfOk">我答对了 ✓</button>';
          html += '<button id="selfNo">没答对 ✗</button>';
        }
      } else if (!showResult) {
        html += '<button id="confirmBtn" class="primary">确认答案</button>';
      }
      html += '<button id="nextBtn" class="primary" ' + (idx >= queue.length - 1 ? "disabled" : "") + '>' +
        (idx >= queue.length - 1 ? "已是最后一题" : "下一题 →") + '</button>';
    } else { // exam
      if (examDone) {
        html += '<button id="showResultBtn" class="submit">查看成绩</button>';
      } else {
        html += '<button id="submitBtn" class="submit">交卷</button>';
      }
      html += '<button id="nextBtn" class="primary" ' + (idx >= queue.length - 1 ? "disabled" : "") + '>下一题 →</button>';
    }
    bar.innerHTML = html;
    bindActionEvents(q, r, showResult);
  }

  function bindActionEvents(q, r, showResult) {
    var p = $("#prevBtn"), n = $("#nextBtn");
    if (p) p.onclick = function () { if (idx > 0) { idx--; renderQuestion(); window.scrollTo(0, 0); } };
    if (n) n.onclick = function () { if (idx < queue.length - 1) { idx++; renderQuestion(); window.scrollTo(0, 0); } };
    var c = $("#confirmBtn");
    if (c) c.onclick = function () {
      if (!rec(q.id).c) { toast("请先选择一个答案"); return; }
      rec(q.id).done = true;
      rec(q.id).ok = (rec(q.id).c === q.answer);
      rec(q.id).t = Date.now();
      saveLocal(); scheduleSync();
      renderQuestion();
    };
    var rv = $("#revealBtn");
    if (rv) rv.onclick = function () {
      rec(q.id).done = true; rec(q.id).t = Date.now();
      saveLocal(); scheduleSync();
      renderQuestion();
    };
    var ok = $("#selfOk"), no = $("#selfNo");
    if (ok) ok.onclick = function () { rec(q.id).ok = true; rec(q.id).t = Date.now(); saveLocal(); scheduleSync(); renderQuestion(); };
    if (no) no.onclick = function () { rec(q.id).ok = false; rec(q.id).t = Date.now(); saveLocal(); scheduleSync(); renderQuestion(); };
    var fb = $("#favBtn");
    if (fb) fb.onclick = function () {
      rec(q.id).f = !rec(q.id).f;
      saveLocal(); scheduleSync();
      renderQuestion();
      renderFavFilter();
    };
    var sb = $("#submitBtn");
    if (sb) sb.onclick = submitExam;
    var srb = $("#showResultBtn");
    if (srb) srb.onclick = showExamResult;
  }

  /* ================= 考试模式 ================= */
  var examResult = null;
  function examLocalKey() { return "ruc-quiz-exam-" + subject + "-" + chapterId; }
  function saveExamLocal() {
    try { localStorage.setItem(examLocalKey(), JSON.stringify(examAnswers)); } catch (e) {}
  }
  function loadExamLocal() {
    try { return JSON.parse(localStorage.getItem(examLocalKey())) || {}; } catch (e) { return {}; }
  }

  function submitExam() {
    var unanswered = queue.filter(function (q) {
      return q.type !== "essay" && !examAnswers[q.id];
    }).length;
    if (unanswered > 0) {
      if (!confirm("还有 " + unanswered + " 道客观题未作答，确定交卷吗？")) return;
    }
    examResult = { grade: {}, wrong: {} };
    var objTotal = 0, objRight = 0;
    queue.forEach(function (q) {
      if (q.type === "essay") return;
      objTotal++;
      var ok = (examAnswers[q.id] === q.answer);
      examResult.grade[q.id] = ok;
      if (ok) objRight++; else examResult.wrong[q.id] = true;
      // 写入进度
      var r = rec(q.id);
      r.c = examAnswers[q.id] || ""; r.done = true; r.ok = ok; r.t = Date.now();
    });
    queue.forEach(function (q) {
      if (q.type === "essay" && examAnswers[q.id]) {
        var r = rec(q.id); r.d = examAnswers[q.id]; r.done = true; r.t = Date.now();
      }
    });
    examResult.objTotal = objTotal; examResult.objRight = objRight;
    examResult.score = objTotal ? Math.round(objRight / objTotal * 100) : null;
    examDone = true;
    saveLocal(); saveExamLocal(); scheduleSync();
    updateStats();
    showExamResult();
  }

  function showExamResult() {
    var ov = $("#examOverlay");
    var essayN = queue.filter(function (q) { return q.type === "essay"; }).length;
    var html = '<div class="result-card">' +
      '<h2>交卷成绩</h2>' +
      '<div class="score">' + (examResult.score == null ? "—" : examResult.score) + '<span>分</span></div>' +
      '<div class="result-meta">客观题 ' + examResult.objRight + ' / ' + examResult.objTotal +
      '　简答/分录题 ' + essayN + ' 道（自评，见题目内参考答案）</div>' +
      '<div class="result-btns">' +
      '<button id="reviewWrongBtn">只看错题</button>' +
      '<button id="reviewAllBtn">逐题查看</button>' +
      '<button id="retryBtn">重新考试</button>' +
      '<button id="closeResultBtn">关闭</button>' +
      '</div></div>';
    ov.innerHTML = html;
    ov.style.display = "flex";
    $("#reviewWrongBtn").onclick = function () { reviewWrong = true; buildQueue(); examDone = true; ov.style.display = "none"; renderQuestion(); };
    $("#reviewAllBtn").onclick = function () { reviewWrong = false; buildQueue(); examDone = true; ov.style.display = "none"; renderQuestion(); };
    $("#retryBtn").onclick = function () {
      if (!confirm("重新考试会清空本次作答，确定？")) return;
      examAnswers = {}; examDone = false; examResult = null; reviewWrong = false;
      saveExamLocal(); buildQueue(); idx = 0; ov.style.display = "none"; renderQuestion();
    };
    $("#closeResultBtn").onclick = function () { ov.style.display = "none"; };
  }

  /* ================= 进度统计 ================= */
  function updateStats() {
    var done = 0, ok = 0, favs = 0;
    DATA.subjects.forEach(function (s) {
      s.chapters.forEach(function (c) {
        c.questions.forEach(function (q) {
          var r = progress[q.id];
          if (r && r.done) { done++; if (r.ok === true) ok++; }
          if (r && r.f) favs++;
        });
      });
    });
    var rate = done ? Math.round(ok / done * 100) : 0;
    $("#stats").textContent = "已做 " + done + "/" + totalCount() + " · 正确率 " + rate + "% · 收藏 " + favs;
    // 章节进度条
    var html = "";
    DATA.subjects.forEach(function (s) {
      html += '<div class="subj-group">' + esc(s.name) + "</div>";
      s.chapters.forEach(function (c) {
        var dn = 0, total = c.questions.length;
        c.questions.forEach(function (q) { if (progress[q.id] && progress[q.id].done) dn++; });
        var pct = total ? Math.round(dn / total * 100) : 0;
        var cur = (subject === s.id && (chapterId === "all" || chapterId === c.id)) ? " cur" : "";
        html += '<div class="ch-row' + cur + '" data-subj="' + esc(s.id) + '" data-ch="' + esc(c.id) + '">' +
          '<span class="ch-name">' + esc(c.title.replace(/^第.+?章 /, "")) + "</span>" +
          '<span class="ch-bar"><i style="width:' + pct + '%"></i></span>' +
          '<span class="ch-num">' + dn + "/" + total + "</span></div>";
      });
    });
    $("#chapterList").innerHTML = html;
    $$("#chapterList .ch-row").forEach(function (el) {
      el.onclick = function () {
        subject = el.getAttribute("data-subj");
        chapterId = el.getAttribute("data-ch");
        closeDrawer();
        applyScope();
      };
    });
    $("#chapterSel").value = chapterId;
  }

  function applyScope() {
    var tabs = $$(".subject-tab");
    tabs.forEach(function (x) { x.className = "subject-tab" + (x.getAttribute("data-subj") === subject ? " on" : ""); });
    if (mode === "exam" && !examDone) {
      examAnswers = loadExamLocal();
      if (!examAnswers || typeof examAnswers !== "object") examAnswers = {};
    }
    populateChapterSel();
    buildQueue();
    idx = 0;
    renderQuestion();
    renderFavFilter();
    updateStats();
  }

  function populateChapterSel() {
    var sel = $("#chapterSel");
    var html = '<option value="all">全部章节</option>';
    subjectChapters().forEach(function (c) {
      html += '<option value="' + esc(c.id) + '">' + esc(c.title) + "</option>";
    });
    sel.innerHTML = html;
    sel.value = chapterId;
  }

  function renderFavFilter() {
    $("#favFilterBtn").className = favOnly ? "chip on" : "chip";
    $("#favFilterBtn").textContent = favOnly ? "★ 只看收藏（开）" : "☆ 只看收藏";
  }

  /* ================= 设置与同步 ================= */
  function openSettings() {
    $("#settingsOverlay").style.display = "flex";
    $("#tokenInput").value = settings.token || "";
    $("#syncKeyInput").value = settings.syncKey || "默认设备";
    $("#syncStatus").textContent = syncStatusText();
  }
  function closeSettings() { $("#settingsOverlay").style.display = "none"; }
  function syncStatusText() {
    if (!settings.token) return "未配置同步：进度只保存在本机浏览器";
    if (settings.lastSync) return "上次同步：" + new Date(settings.lastSync).toLocaleString() + "（标识：" + (settings.syncKey || "默认设备") + "）";
    return "已配置 token，尚未同步";
  }

  function gistHeaders() {
    return {
      "Accept": "application/vnd.github+json",
      "Authorization": "token " + settings.token,
      "X-GitHub-Api-Version": "2022-11-28"
    };
  }
  function http(method, url, body) {
    return fetch(url, {
      method: method,
      headers: gistHeaders(),
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      if (!res.ok) return res.json().then(function (j) { throw new Error(j.message || res.status); });
      return res.json();
    });
  }
  function findGist() {
    // 先查缓存 id
    var cached = settings.gistId;
    var check = function (gists) {
      for (var i = 0; i < gists.length; i++) {
        var g = gists[i];
        if (g.description && g.description.indexOf(GIST_DESC) !== -1) return g;
        if (g.files && g.files[GIST_FILENAME]) return g;
      }
      return null;
    };
    if (cached) {
      return http("GET", API + "/gists/" + cached)
        .then(function (g) { return g; })
        .catch(function () { return http("GET", API + "/gists?per_page=100").then(check); });
    }
    return http("GET", API + "/gists?per_page=100").then(check);
  }

  function syncGist() {
    if (!settings.token) return Promise.resolve();
    var payload = {
      updatedAt: Date.now(),
      syncKey: settings.syncKey || "默认设备",
      progress: progress
    };
    var body = {
      description: GIST_DESC + " | 人大会计财管期末题库进度",
      files: {}
    };
    body.files[GIST_FILENAME] = { content: JSON.stringify(payload) };
    return findGist().then(function (g) {
      if (g) {
        settings.gistId = g.id; saveSettings();
        return http("PATCH", API + "/gists/" + g.id, body);
      }
      return http("POST", API + "/gists", { description: body.description, public: false, files: body.files });
    }).then(function (g) {
      settings.gistId = g.id; settings.lastSync = Date.now(); saveSettings();
      $("#syncStatus").textContent = syncStatusText();
      return g;
    }).catch(function (e) {
      $("#syncStatus").textContent = "同步失败：" + e.message + "（请检查 token 是否有 gist 权限）";
      throw e;
    });
  }

  function pullFromGist() {
    if (!settings.token) return Promise.resolve();
    return findGist().then(function (g) {
      if (!g) return null;
      settings.gistId = g.id; saveSettings();
      var f = g.files && g.files[GIST_FILENAME];
      if (!f) return null;
      if (f.truncated) {
        return http("GET", f.raw_url).then(function (txt) { return JSON.parse(txt); });
      }
      return JSON.parse(f.content);
    }).then(function (remote) {
      if (!remote || !remote.progress) return null;
      return mergeRemote(remote.progress);
    }).catch(function (e) {
      $("#syncStatus").textContent = "拉取进度失败：" + e.message;
      return null;
    });
  }

  function mergeRemote(remote) {
    var changed = false;
    Object.keys(remote).forEach(function (qid) {
      var rr = remote[qid], lr = progress[qid];
      if (!lr || !lr.t || (rr.t && rr.t > (lr.t || 0))) {
        progress[qid] = rr; changed = true;
      } else if (rr.f && !lr.f) {
        lr.f = true; changed = true;
      }
    });
    Object.keys(progress).forEach(function (qid) {
      var lr = progress[qid], rr = remote[qid];
      if (!rr && lr.t) { changed = true; } // 本机较新，待上传
    });
    if (changed) saveLocal();
    return changed;
  }

  function scheduleSync() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      if (!settings.token) return;
      $("#syncStatus").textContent = "同步中…";
      syncGist().catch(function () {});
    }, 4000);
  }

  /* ================= UI 事件 ================= */
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.className = "show";
    setTimeout(function () { t.className = ""; }, 1800);
  }

  function closeDrawer() {
    $("#drawer").classList.remove("open");
    $("#backdrop").classList.remove("show");
  }

  function init() {
    // 顶栏
    $("#menuBtn").onclick = function () { $("#drawer").classList.add("open"); $("#backdrop").classList.add("show"); };
    $("#backdrop").onclick = closeDrawer;
    $("#setBtn").onclick = openSettings;
    $("#closeSettings").onclick = closeSettings;
    $("#favFilterBtn").onclick = function () { favOnly = !favOnly; buildQueue(); idx = 0; renderQuestion(); renderFavFilter(); };
    $$("#drawer .mode-seg button").forEach(function (b) {
      b.onclick = function () {
        var m = b.getAttribute("data-mode");
        if (m === mode) return;
        mode = m;
        if (mode === "exam") { examDone = false; examResult = null; reviewWrong = false; examAnswers = loadExamLocal(); }
        $$("#drawer .mode-seg button").forEach(function (x) { x.className = x === b ? "on" : ""; });
        buildQueue(); idx = 0; renderQuestion(); renderFavFilter();
      };
    });
    $$(".subject-tab").forEach(function (b) {
      b.onclick = function () {
        if (b.getAttribute("data-subj") === subject && chapterId === "all") return;
        subject = b.getAttribute("data-subj");
        chapterId = "all";
        applyScope();
      };
    });
    $("#chapterSel").onchange = function () { chapterId = this.value; applyScope(); };
    // 设置面板
    $("#saveSettings").onclick = function () {
      settings.token = $("#tokenInput").value.trim();
      settings.syncKey = $("#syncKeyInput").value.trim() || "默认设备";
      saveSettings();
      $("#syncStatus").textContent = "设置已保存，开始测试同步…";
      syncGist().then(function () { $("#syncStatus").textContent = syncStatusText(); toast("同步成功 ✓"); })
        .catch(function () {});
    };
    $("#testSync").onclick = function () {
      if (!settings.token) { toast("请先粘贴 token 并保存"); return; }
      $("#syncStatus").textContent = "测试中…";
      syncGist().then(function () { toast("同步成功 ✓"); }).catch(function () {});
    };
    $("#pullSync").onclick = function () {
      if (!settings.token) { toast("请先粘贴 token 并保存"); return; }
      $("#syncStatus").textContent = "拉取中…";
      pullFromGist().then(function (changed) {
        $("#syncStatus").textContent = syncStatusText();
        toast(changed === null ? "远端暂无数据" : "进度已合并到本机 ✓");
        renderQuestion(); updateStats();
      });
    };
    $("#clearLocal").onclick = function () {
      if (!confirm("清空本机所有做题进度与收藏？（远端 gist 数据不受影响）")) return;
      progress = {}; saveLocal(); renderQuestion(); updateStats();
    };
    $("#clearAll").onclick = function () {
      if (!confirm("同时清空本机进度并覆盖清空远端 gist？此操作不可恢复！")) return;
      progress = {}; saveLocal();
      if (settings.token) {
        syncGist().then(function () { toast("已清空 ✓"); }).catch(function () {});
      }
      renderQuestion(); updateStats();
    };

    // 初始渲染
    applyScope();
    // 若配置了 token，启动时拉取远端合并
    if (settings.token) {
      $("#syncStatus").textContent = "启动拉取进度中…";
      pullFromGist().then(function () { renderQuestion(); updateStats(); });
    }
    // 退出前尝试同步
    window.addEventListener("beforeunload", function () {
      if (settings.token && navigator.sendBeacon === undefined) {
        try { fetch(API, { method: "POST", keepalive: true }); } catch (e) {}
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
