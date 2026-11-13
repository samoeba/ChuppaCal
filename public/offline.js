(function () {
  var key = "chuppacal-offline-today-v1";
  var host = document.getElementById("snapshot");
  function clear() {
    try { localStorage.removeItem(key); } catch {}
    host.textContent = "No saved snapshot on this device.";
  }
  document.getElementById("clear").addEventListener("click", clear);
  try {
    var raw = localStorage.getItem(key);
    if (!raw) { clear(); return; }
    var data = JSON.parse(raw);
    if (!data || !Number.isFinite(data.savedAt) || Date.now() - data.savedAt > 7*86400000 || !Array.isArray(data.events) || !Array.isArray(data.chores)) { clear(); return; }
    host.textContent = "";
    var heading = document.createElement("h2"); heading.textContent = String(data.date || "Saved day"); host.appendChild(heading);
    var stamp = document.createElement("p"); stamp.textContent = "Saved " + new Date(data.savedAt).toLocaleString() + ". It may be out of date."; host.appendChild(stamp);
    function section(title, values) {
      var card = document.createElement("section"), h = document.createElement("h2"), list = document.createElement("ul");
      h.textContent = title; card.appendChild(h);
      values.forEach(function (value) { var item=document.createElement("li"); item.textContent=String(value); list.appendChild(item); });
      if (!values.length) { var empty=document.createElement("p"); empty.textContent="Nothing saved."; card.appendChild(empty); }
      else card.appendChild(list);
      host.appendChild(card);
    }
    section("Coming up", data.events.slice(0,20));
    section("Dinner", data.dinner ? [data.dinner] : []);
    section("Teamwork", data.chores.slice(0,20));
  } catch { clear(); }
}());
