(function () {
  bindReviews();
  bindBays();
  bindForm();

  function bindReviews() {
    var reel = document.querySelector(".reel");
    if (!reel) return;
    var track = reel.querySelector(".reel-track");
    if (!track || !track.children.length) return;
    var originals = Array.prototype.slice.call(track.children);
    originals.forEach(function (card) { track.appendChild(card.cloneNode(true)); });
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var x = 0;
    var speed = reduce ? 0 : 0.55;
    var paused = false;
    var dragging = false;
    var startX = 0;
    var startOffset = 0;
    var last = 0;
    function loopWidth() { return track.scrollWidth / 2; }
    function frame(now) {
      if (!last) last = now;
      var dt = now - last;
      last = now;
      if (!paused && !dragging && speed) x -= speed * dt / 16;
      var span = loopWidth();
      if (span) {
        if (x <= -span) x += span;
        if (x > 0) x -= span;
      }
      track.style.transform = "translate3d(" + x + "px,0,0)";
      window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
    reel.addEventListener("mouseenter", function () { paused = true; });
    reel.addEventListener("mouseleave", function () { if (!dragging) paused = false; });
    reel.addEventListener("focusin", function () { paused = true; });
    reel.addEventListener("focusout", function () { paused = false; });
    reel.addEventListener("pointerdown", function (event) {
      if (event.target.closest("a, button")) return;
      dragging = true;
      paused = true;
      startX = event.clientX;
      startOffset = x;
      reel.setPointerCapture(event.pointerId);
    });
    reel.addEventListener("pointermove", function (event) {
      if (!dragging) return;
      x = startOffset + (event.clientX - startX);
    });
    function endDrag() { dragging = false; paused = false; }
    reel.addEventListener("pointerup", endDrag);
    reel.addEventListener("pointercancel", endDrag);
    reel.addEventListener("keydown", function (event) {
      if (event.key === "ArrowRight") x -= 280;
      if (event.key === "ArrowLeft") x += 280;
    });
  }

  function bindBays() {
    var dialogNode = document.querySelector(".nav-screen");
    if (!dialogNode) return;
    var title = document.getElementById("nav-title");
    var address = document.getElementById("nav-address");
    var frame = dialogNode.querySelector(".nav-map");
    var out = document.getElementById("nav-out");
    var close = dialogNode.querySelector("[data-close]");
    document.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-bay]");
      if (!button) return;
      var name = button.getAttribute("data-name") || "";
      var placeAddress = button.getAttribute("data-address") || "";
      var lat = button.getAttribute("data-lat");
      var lon = button.getAttribute("data-lon");
      var hasPoint = isCoord(lat, -90, 90) && isCoord(lon, -180, 180);
      title.textContent = name || "Карта";
      if (hasPoint) {
        address.textContent = placeAddress || "Адрес не указан";
        frame.title = placeAddress ? "Карта: " + placeAddress : "Карта";
        frame.src = mapSrc(Number(lat), Number(lon));
        out.hidden = false;
        out.href = mapLink(Number(lat), Number(lon));
      } else {
        frame.removeAttribute("src");
        frame.title = "Карта";
        out.hidden = true;
        out.removeAttribute("href");
        address.textContent = placeAddress
          ? placeAddress + " Координаты не заданы, карта не строится."
          : "Адрес не указан. Координаты не заданы, карта не строится.";
      }
      if (typeof dialogNode.showModal === "function") dialogNode.showModal();
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () { dialogNode.classList.add("is-in"); });
      });
      close.focus();
    });
    function shut() {
      if (!dialogNode.open) return;
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      dialogNode.classList.remove("is-in");
      dialogNode.classList.add("is-out");
      if (reduce) {
        dialogNode.classList.remove("is-out");
        dialogNode.close();
        return;
      }
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        dialogNode.classList.remove("is-out");
        if (dialogNode.open) dialogNode.close();
      }
      dialogNode.addEventListener("transitionend", finish, { once: true });
      window.setTimeout(finish, 280);
    }
    close.addEventListener("click", shut);
    dialogNode.addEventListener("cancel", function (event) {
      event.preventDefault();
      shut();
    });
    dialogNode.addEventListener("click", function (event) {
      if (event.target === dialogNode) shut();
    });
    dialogNode.addEventListener("close", function () {
      dialogNode.classList.remove("is-in");
      dialogNode.classList.remove("is-out");
      frame.removeAttribute("src");
    });
  }

  function bindForm() {
    var form = document.getElementById("request-form");
    if (!form) return;
    var status = form.querySelector(".form-status");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var data = new FormData(form);
      var name = String(data.get("name") || "").trim();
      var phone = String(data.get("phone") || "").trim();
      var service = String(data.get("service") || "").trim() || "Не выбрана";
      var digits = phone.replace(/\D/g, "");
      status.classList.remove("is-error");
      if (!name) return fail("Напишите имя — без него заявку не собрать.");
      if (!phone) return fail("Напишите телефон, чтобы можно было перезвонить.");
      if (digits.length < 10) return fail("В телефоне мало цифр. Проверьте номер.");
      var channel = form.getAttribute("data-channel") || "";
      var target = form.getAttribute("data-target") || "";
      if (!channel || !target || isFictional(target)) {
        return fail("Заявка в этом демо не отправляется: адрес приёма не указан.");
      }
      var text = "Имя: " + name + "\nТелефон: " + phone + "\nУслуга: " + service;
      if (channel === "telegram") {
        var user = target.replace(/^@/, "");
        var url = "https://t.me/" + encodeURIComponent(user) + "?text=" + encodeURIComponent(text);
        var opened = window.open(url, "_blank", "noopener");
        if (opened) status.textContent = "Заявка собрана. Откроется Telegram — отправьте сообщение.";
        else status.textContent = "Окно не открылось. Откройте Telegram вручную.";
        return;
      }
      if (channel === "mailto") {
        window.location.href = "mailto:" + target + "?subject=" + encodeURIComponent("Заявка") + "&body=" + encodeURIComponent(text);
        status.textContent = "Заявка собрана. Откроется почта — отправьте письмо.";
        return;
      }
      fail("Заявка в этом демо не отправляется: адрес приёма не указан.");
    });
    function fail(message) {
      status.textContent = message;
      status.classList.add("is-error");
    }
    bindPicker(form);
  }

  function bindPicker(form) {
    var picker = form.querySelector(".picker");
    if (!picker) return;
    var button = picker.querySelector(".picker-btn");
    var list = picker.querySelector(".picker-list");
    var input = picker.querySelector("input[name=service]");
    function setOpen(open) {
      picker.classList.toggle("is-open", open);
      button.setAttribute("aria-expanded", open ? "true" : "false");
    }
    button.addEventListener("click", function () { setOpen(!picker.classList.contains("is-open")); });
    list.addEventListener("click", function (event) {
      var choice = event.target.closest("[data-value]");
      if (!choice) return;
      input.value = choice.getAttribute("data-value");
      button.textContent = choice.textContent;
      list.querySelectorAll("[data-value]").forEach(function (node) { node.classList.remove("is-on"); });
      choice.classList.add("is-on");
      setOpen(false);
    });
    document.addEventListener("click", function (event) {
      if (!picker.contains(event.target)) setOpen(false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setOpen(false);
    });
  }

  function isCoord(value, min, max) {
    if (value == null || value === "") return false;
    var number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max;
  }

  function isFictional(target) {
    return /reglament\.example|@(example\.(com|org|net|edu)|localhost)$/i.test(target);
  }

  function mapSrc(lat, lon) {
    var ll = lon + "," + lat;
    return "https://yandex.ru/map-widget/v1/?ll=" + ll + "&z=16&pt=" + ll + ",pm2rdm&l=map";
  }

  function mapLink(lat, lon) {
    var ll = lon + "," + lat;
    return "https://yandex.ru/maps/?ll=" + ll + "&z=16&pt=" + ll + "&l=map";
  }
})();
