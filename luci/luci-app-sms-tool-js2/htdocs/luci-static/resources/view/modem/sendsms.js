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

async function getModemIndex() {
try {
await uci.load('sms_tool_js');
const modemIdx = uci.get('sms_tool_js', '@sms_tool_js[0]', 'modem_index');
return modemIdx || '0';
} catch(e) {
return '0';
}
}

return view.extend({
handleCommand: function(exec, args) {
const buttons = document.querySelectorAll('.cbi-button');

for (let i = 0; i < buttons.length; i++)
buttons[i].setAttribute('disabled', 'true');

return fs.exec(exec, args).then(function(res) {
const out = document.querySelector('.smscommand-output');
out.style.display = '';

res.stdout = res.stdout?.replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, "") || '';
res.stderr = res.stderr?.replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, "") || '';

// Check if SMS was sent successfully
if (res.stdout.includes('successfully') || res.stderr.includes('successfully')) {
res.stdout = _('SMS sent successfully');
}

dom.content(out, [ res.stdout || '', res.stderr || '' ]);

}).catch(function(err) {
ui.addNotification(null, E('p', [ err ]))
}).finally(function() {
for (let i = 0; i < buttons.length; i++)
buttons[i].removeAttribute('disabled');
});
},

handleGo: async function(ev) {
const phn = document.getElementById('phonenumber').value;
const get_smstxt = document.getElementById('smstext').value;
const elem = document.getElementById('execute');
const vN = elem.innerText;

await uci.load('sms_tool_js');
const modemIdx = await getModemIndex();
const dx = (uci.get('sms_tool_js', '@sms_tool_js[0]', 'delay') || 3) * 1000;

if (vN.includes(_('Send to number'))) {
if (phn.length < 3) {
ui.addNotification(null, E('p', _('Please enter phone number')), 'info');
return false;
}

if (!modemIdx) {
ui.addNotification(null, E('p', _('Please configure the modem')), 'info');
return false;
}

if (get_smstxt.length < 1) {
ui.addNotification(null, E('p', _('Please enter a message text')), 'info');
return false;
}

// Create and send SMS using mmcli
// First create SMS: mmcli -m 0 --messaging-create-sms="text='hello',number='1234567890'"
// Then send: mmcli -m 0 -s /org/freedesktop/ModemManager1/SMS/X --send
try {
const createRes = await fs.exec('/usr/bin/mmcli', [
'-m', modemIdx,
'--messaging-create-sms=text=' + get_smstxt + ',number=' + phn
]);

if (createRes && createRes.stdout) {
// Extract SMS path from output
const match = createRes.stdout.match(/\/SMS\/\d+/);
if (match) {
const smsPath = match[0];
// Send the SMS
const sendRes = await fs.exec('/usr/bin/mmcli', [
'-m', modemIdx,
'-s', smsPath,
'--send'
]);

const out = document.querySelector('.smscommand-output');
out.style.display = '';
dom.content(out, [ _('SMS sent successfully to ') + phn ]);
}
}
} catch(e) {
ui.addNotification(null, E('p', _('Error sending SMS: ') + e.message), 'error');
}

} else {
// Group messaging
if (!modemIdx) {
ui.addNotification(null, E('p', _('Please configure the modem')), 'info');
return false;
}

if (get_smstxt.length < 1) {
ui.addNotification(null, E('p', _('Please enter a message text')), 'info');
return false;
}

const xs = document.getElementById('pb');
const out = document.querySelector('.smscommand-output');
out.style.display = '';
let outputText = '';

for (let i = 0; i < xs.length; i++) {
(function(i) {
setTimeout(async function() {
const phone = xs.options[i].value;

try {
const createRes = await fs.exec('/usr/bin/mmcli', [
'-m', modemIdx,
'--messaging-create-sms=text=' + get_smstxt + ',number=' + phone
]);

if (createRes && createRes.stdout) {
const match = createRes.stdout.match(/\/SMS\/\d+/);
if (match) {
const smsPath = match[0];
await fs.exec('/usr/bin/mmcli', [
'-m', modemIdx,
'-s', smsPath,
'--send'
]);

outputText += (i+1) + _('/') + xs.length + ' * ' + _('[Bot] Message sent to number:') + ' ' + phone + '\n';
dom.content(out, [ outputText ]);
}
}
} catch(e) {
outputText += (i+1) + _('/') + xs.length + ' * ' + _('[Bot] Failed to send to:') + ' ' + phone + '\n';
dom.content(out, [ outputText ]);
}
}, dx * i);
})(i);
}
}
},

handleClear: function(ev) {
const out = document.querySelector('.smscommand-output');
out.style.display = 'none';

const ovc = document.getElementById('phonenumber');
const ov2 = document.getElementById('smstext');
ov2.value = '';

document.getElementById('counter').innerHTML = '160';

uci.load('sms_tool_js').then(function() {
const sections = uci.sections('sms_tool_js');
const addprefix = sections[0].prefix;
if (addprefix == '1') {
const prefixnum = sections[0].pnumber;
ovc.value = prefixnum;
} else {
ovc.value = '';
}
});

document.getElementById('phonenumber').focus();
},

handleCopy: function(ev) {
const out = document.querySelector('.smscommand-output');
out.style.display = 'none';

const ov = document.getElementById('phonenumber');
ov.value = '';
const x = document.getElementById('pb').value;
ov.value = x;
},

load: function() {
return Promise.all([
L.resolveDefault(fs.read_direct('/etc/modem/phonebook.user'), null),
uci.load('sms_tool_js').then(function() {
if (!uci.get('sms_tool_js', '@sms_tool_js[0]')) {
uci.add('sms_tool_js', 'sms_tool_js');
uci.set('sms_tool_js', '@sms_tool_js[0]', 'modem_index', '0');
}
})
]);
},

render: function (loadResults) {
uci.load('sms_tool_js').then(function() {
const sections = uci.sections('sms_tool_js');
let group = sections[0].sendingroup == '1' ? 1 : '';
let prefixnum = '';

if (sections[0].prefix == '1') {
prefixnum = sections[0].pnumber;
}

if (sections[0].information == '1') {
ui.addNotification(null, E('p', _('The phone number should be preceded by the country prefix (for Poland it is 48, without +). If the number is 5, 4 or 3 characters, it is treated as short and should not be preceded by a country prefix.')), 'info');
}
});

const info = _('User interface for sending messages using ModemManager mmcli. More information about ModemManager on the %sModemManager documentation%s.').format('<a href="https://www.freedesktop.org/wiki/Software/ModemManager/" target="_blank">', '</a>');

return E('div', { 'class': 'cbi-map', 'id': 'map' }, [
E('h2', {}, [ _('SMS Messages') ]),
E('div', { 'class': 'cbi-map-descr'}, info),
E('hr'),
E('div', { 'class': 'cbi-section' }, [
E('div', { 'class': 'cbi-section-node' }, [
E('div', { 'class': 'cbi-value' }, [
E('label', { 'class': 'cbi-value-title' }, [ _('User contacts') ]),
E('div', { 'class': 'cbi-value-field' }, [
E('select', { 'class': 'cbi-input-select',
'id': 'pb',
'style': 'margin:5px 0; width:100%;',
'change': ui.createHandlerFn(this, 'handleCopy'),
'mousedown': ui.createHandlerFn(this, 'handleCopy')
    },
(loadResults[0] || "").trim().split("\n").map(function(cmd) {
                                        const fields = cmd.split(/;/);
                                        const name = fields[0];
                                        const code = fields[1] || fields[0];
                                        return E('option', { 'value': code }, name );
                                    })
)
]) 
]),
E('div', { 'class': 'cbi-value' }, [
E('label', { 'class': 'cbi-value-title' }, [ _('Send to') ]),
E('div', { 'class': 'cbi-value-field' }, [
E('input', {
'style': 'margin:5px 0; width:100%;',
'type': 'text',
'id': 'phonenumber',
'value': uci.get('sms_tool_js', '@sms_tool_js[0]', 'prefix') == '1' ? uci.get('sms_tool_js', '@sms_tool_js[0]', 'pnumber') : '',
'oninput': "this.value = this.value.replace(/[^0-9.]/g, '');",
'data-tooltip': _('Press [Delete] to delete the phone number'),
'keydown': function(ev) {
if (ev.keyCode === 46) {
uci.load('sms_tool_js').then(function() {
const sections = uci.sections('sms_tool_js');
const addprefix = sections[0].prefix;
const ovc = document.getElementById('phonenumber');
if (addprefix == '1') {
const prefixnum = sections[0].pnumber;
ovc.value = prefixnum;
} else {
ovc.value = '';
}
document.getElementById('phonenumber').focus();
});
}
},
}),
])
]),
E('div', { 'class': 'cbi-value' }, [
E('label', { 'class': 'cbi-value-title' }, [ _('Message text') ]),
E('div', { 'class': 'cbi-value-field' }, [
E('textarea', {
'id': 'smstext',
'style': 'width: 100%; resize: vertical; height:80px; max-height:80px; min-height:80px; min-width:100%;',
'wrap': 'on',
'rows': '3',
'placeholder': _(''),
'maxlength': '160',
'data-tooltip': _('Press [Delete] to delete the content of the message'),
'keydown': function(ev) {
if (ev.keyCode === 46) {
const ovtxt = document.getElementById('smstext');
ovtxt.value = '';
document.getElementById('smstext').focus();
}
},
'keyup': function(ev) {  
document.getElementById('counter').innerHTML = (160 - document.getElementById('smstext').value.length);

// Remove Polish diacritics
this.value = this.value.replace(/ą/g, 'a').replace(/Ą/g, 'A');
this.value = this.value.replace(/ć/g, 'c').replace(/Ć/g, 'C');
this.value = this.value.replace(/ę/g, 'e').replace(/Ę/g, 'E');
this.value = this.value.replace(/ł/g, 'l').replace(/Ł/g, 'L');
this.value = this.value.replace(/ń/g, 'n').replace(/Ń/g, 'N');
this.value = this.value.replace(/ó/g, 'o').replace(/Ó/g, 'O');
this.value = this.value.replace(/ś/g, 's').replace(/Ś/g, 'S');
this.value = this.value.replace(/ż/g, 'z').replace(/Ż/g, 'Z');
this.value = this.value.replace(/ź/g, 'z').replace(/Ź/g, 'Z');
}
}),
E('div', { 'class': 'left' }, [
E('br'),
E('label', { 'id': 'counter' }, [ _('160') ])
])
]),
]),

])
]),
E('hr'),
E('div', { 'class': 'right' }, [
E('button', {
'class': 'cbi-button cbi-button-remove',
'id': 'clr',
'click': ui.createHandlerFn(this, 'handleClear')
}, [ _('Clear form') ]),
'\xa0\xa0\xa0',
E('span', { 'class': 'diag-action' }, [
uci.get('sms_tool_js', '@sms_tool_js[0]', 'sendingroup') == '1' ? new ui.ComboButton('send', {
'send': '%s %s'.format(_('Send'), _('to number')),
'sendg': '%s %s'.format(_('Send'), _('to group')),
}, {
'click': ui.createHandlerFn(this, 'handleGo'),
'id': 'execute',
'classes': {
'send': 'cbi-button cbi-button-action important',
'sendg': 'cbi-button cbi-button-action important',
},
}).render() : E('button', {
'class': 'cbi-button cbi-button-action important',
'id': 'execute',
'click': ui.createHandlerFn(this, 'handleGo')
}, [ _('Send to number') ]),
]),
]),
E('p', _('Status')),
E('pre', { 'class': 'smscommand-output', 'id': 'ans', 'style': 'display:none; border: 1px solid var(--border-color-medium); border-radius: 5px; font-family: monospace' }),
]);
},

handleSaveApply: null,
handleSave: null,
handleReset: null
})
