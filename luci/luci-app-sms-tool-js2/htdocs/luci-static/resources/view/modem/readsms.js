'use strict';
'require dom';
'require form';
'require fs';
'require ui';
'require uci';
'require view';

/*
Copyright 2022-2025 Rafał Wabik - IceG - From eko.one.pl forum
Refactored for ModemManager/mmcli - December 2025

Licensed to the GNU General Public License v3.0.
*/

document.head.append(E('style', {'type': 'text/css'},
`
#smsTable {
  width: 100%;
  border: 1px solid var(--border-color-medium) !important;
}

th, td {
  padding: 10px;
  text-align: justify !important;
  vertical-align: top !important;
}

td input[type="checkbox"] {
  float: left !important;
  margin: 0 auto !important;
  width: 17px !important;
}

#smsTable tr:nth-child(odd) td{
  background: var(--background-color-medium) !important;
  border-bottom: 1px solid var(--border-color-medium) !important;
  border-top: 1px solid var(--border-color-medium) !important;
}

#smsTable tr:nth-child(even) td{
  border-bottom: 1px solid var(--border-color-medium) !important;
  border-top: 1px solid var(--border-color-medium) !important;
}

#smsTable .checker {
  width: 7% !important;
}

#smsTable .from {
  width: 11% !important;
}

#smsTable .received {
  width: 15% !important;
}

#smsTable .message {
  width: 88% !important;
}
`));

async function getModemIndex() {
try {
const modemIdx = uci.get('sms_tool_js', '@sms_tool_js[0]', 'modem_index');
return modemIdx || '0';
} catch(e) {
return '0';
}
}

return view.extend({
load: function() {
return uci.load('sms_tool_js').then(function() {
if (!uci.get('sms_tool_js', '@sms_tool_js[0]')) {
return uci.add('sms_tool_js', 'sms_tool_js');
}
});
},

handleDelete: async function(ev) {
const checkedBoxes = document.querySelectorAll('input[name="smsn"]:checked');

if (checkedBoxes.length === 0) {
ui.addNotification(null, E('p', _('Please select the message(s) to be deleted')), 'info');
return;
}

const confirmMsg = checkedBoxes.length === document.querySelectorAll('input[name="smsn"]').length
? _('Delete all the messages?')
: _('Delete selected message(s)?');

if (!confirm(confirmMsg)) {
return;
}

try {
const modemIdx = await getModemIndex();
const table = document.getElementById('smsTable');
const deletelabel = document.getElementById('deleteinfo');
deletelabel.style.display = 'block';

let deleted = 0;
const total = checkedBoxes.length;

for (const checkbox of checkedBoxes) {
const smsPath = checkbox.id;

try {
await fs.exec('/usr/bin/mmcli', ['-m', modemIdx, '--messaging-delete-sms=' + smsPath]);
deleted++;
deletelabel.innerHTML = _('Please wait... deleted') + ' ' + deleted + ' ' + _('of') + ' ' + total + ' ' + _('selected messages');

// Remove row from table
let index = 1;
while (index < table.rows.length) {
const input = table.rows[index].cells[0].children[0];
if (input && input.id === smsPath) {
table.deleteRow(index);
break;
}
index++;
}
} catch(e) {
console.error('Failed to delete SMS:', smsPath, e);
}
}

setTimeout(() => {
deletelabel.style.display = 'none';
}, 2000);

document.getElementById('ch-all').checked = false;

} catch(e) {
ui.addNotification(null, E('p', _('Error deleting messages: ') + e.message), 'error');
}
},

handleRefresh: function(ev) {
window.location.reload();
},

handleSelect: function(ev) {
const checkBox = document.getElementById('ch-all');
const checkBoxes = document.querySelectorAll('input[type="checkbox"]');

if (checkBox.checked) {
checkBoxes.forEach(cb => cb.setAttribute('checked', 'true'));
} else {
checkBoxes.forEach(cb => cb.removeAttribute('checked'));
}
},

render: async function(data) {
try {
await uci.load('sms_tool_js');
const modemIdx = await getModemIndex();

// Check if modem is available
try {
await fs.exec('/usr/bin/mmcli', ['-m', modemIdx]);
} catch(e) {
ui.addNotification(null, E('p', _('The package requires user configuration. Please ensure ModemManager is running and a modem is detected.')), 'info');
}

// Get SMS list from ModemManager
const listRes = await fs.exec('/usr/bin/mmcli', ['-m', modemIdx, '--messaging-list-sms']);

if (!listRes || !listRes.stdout) {
return this.renderView([], 0, 100);
}

const lines = listRes.stdout.trim().split('\n');
const smsPaths = [];

for (const line of lines) {
const match = line.match(/\/org\/freedesktop\/ModemManager1\/SMS\/\d+/);
if (match) {
smsPaths.push(match[0]);
}
}

const totalSms = smsPaths.length;

// Fetch each SMS details
const messages = [];
for (const smsPath of smsPaths) {
try {
const smsRes = await fs.exec('/usr/bin/mmcli', ['-m', modemIdx, '--sms=' + smsPath, '-K']);

if (smsRes && smsRes.stdout) {
const smsData = this.parseSmsOutput(smsRes.stdout, smsPath);
if (smsData) {
messages.push(smsData);
}
}
} catch(e) {
console.error('Failed to fetch SMS:', smsPath, e);
}
}

// Sort messages by timestamp (newest first)
messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

return this.renderView(messages, totalSms, 100);

} catch(e) {
console.error('Render error:', e);
ui.addNotification(null, E('p', _('Error loading messages: ') + e.message), 'error');
return this.renderView([], 0, 100);
}
},

parseSmsOutput: function(output, smsPath) {
const lines = output.split('\n');
const data = {
path: smsPath,
index: smsPath.split('/').pop(),
sender: '',
timestamp: '',
content: '',
part: 0,
total: 1,
state: ''
};

for (const line of lines) {
const trimmedLine = line.trim();

// Parse key-value format from mmcli -K
if (trimmedLine.includes(':')) {
const colonIndex = trimmedLine.indexOf(':');
const key = trimmedLine.substring(0, colonIndex).trim();
const value = trimmedLine.substring(colonIndex + 1).trim();
if (key === 'sms.content.number') {
data.sender = value;
} else if (key === 'sms.content.text') {
data.content = value;
} else if (key === 'sms.properties.timestamp') {
data.timestamp = this.formatTimestamp(value);
} else if (key === 'sms.properties.state') {
data.state = value;
}
}
}

// Return message if it has content and sender
if (data.content && data.sender) {
return data;
}
return null;
},

formatTimestamp: function(timestamp) {
// Convert ModemManager timestamp to readable format
try {
if (!timestamp || timestamp === '') {
return 'N/A';
}
const date = new Date(timestamp);
if (isNaN(date.getTime())) {
return timestamp;
}
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0');
const day = String(date.getDate()).padStart(2, '0');
const hours = String(date.getHours()).padStart(2, '0');
const minutes = String(date.getMinutes()).padStart(2, '0');
return `${year}-${month}-${day} ${hours}:${minutes}`;
} catch(e) {
console.error('Timestamp parse error:', e, timestamp);
return timestamp || 'N/A';
}
},

renderView: function(messages, used, total) {
const table = [];
const Lres = L.resource('icons/newdelsms.png');
const iconz = String.format('<img style="width: 24px; height: 24px; "src="%s"/>', Lres);

for (const msg of messages) {
table.push(E('tr', {}, [
E('td', {}, [
E('input', {
'type': 'checkbox',
'name': 'smsn',
'id': msg.path
}),
E('span', { 'innerHTML': iconz })
]),
E('td', {}, msg.sender),
E('td', {}, msg.timestamp),
E('td', {}, msg.content.replace(/\s+/g, ' ').trim())
]));
}

const v = E([], [
E('h2', _('SMS Messages')),
E('div', { 'class': 'cbi-map-descr' }, _('User interface for reading messages using ModemManager mmcli. More information on the %sModemManager documentation%s.').format('<a href="https://www.freedesktop.org/wiki/Software/ModemManager/" target="_blank">', '</a>')),

E('h3', _('Received Messages')),

E('div', {
'style': 'text-align:center;font-size:90%;display:none',
'id': 'deleteinfo'
}, [ '' ]),

E('div', { 'class': 'right' }, [
E('button', {
'class': 'cbi-button cbi-button-remove',
'id': 'execute',
'click': ui.createHandlerFn(this, 'handleDelete')
}, [ _('Delete message(s)') ]),
'\xa0\xa0\xa0',
E('button', {
'class': 'cbi-button cbi-button-add',
'id': 'clr',
'click': ui.createHandlerFn(this, 'handleRefresh')
}, [ _('Refresh messages') ]),
]),

E('p'),

E('table', { 'class': 'table' , 'id' : 'smsTable' }, [
E('tr', { 'class': 'tr table-titles' }, [
E('th', { 'class': 'th checker' }, 
E('input', {
'id': 'ch-all',
'type': 'checkbox',
'name': 'checkall',
'disabled': null,
'checked': null,
'click': ui.createHandlerFn(this, 'handleSelect')
}), '',
),
E('th', { 'class': 'th from' }, _('From')),
E('th', { 'class': 'th received' }, _('Received')),
E('th', { 'class': 'th center message' }, _('Message'))
]),
...table
]),
]);

return v;
},

handleSaveApply: null,
handleSave: null,
handleReset: null
});
