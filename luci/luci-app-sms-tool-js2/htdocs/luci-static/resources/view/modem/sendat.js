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
const out = document.querySelector('.atcommand-output');
out.style.display = '';

res.stdout = res.stdout?.replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, "") || '';
res.stderr = res.stderr?.replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, "") || '';

if (res.stdout && res.stdout.length > 0) {
dom.content(out, [ res.stdout ]);
} else if (res.stderr && res.stderr.length > 0) {
dom.content(out, [ res.stderr ]);
}

}).catch(function(err) {
const out = document.querySelector('.atcommand-output');
if (err && err.message) {
dom.content(out, [ err.message ]);
}
}).finally(function() {
for (let i = 0; i < buttons.length; i++)
buttons[i].removeAttribute('disabled');
});
},

handleGo: async function(ev) {
const atcmd = document.getElementById('cmdvalue').value;

if (atcmd.length < 2) {
ui.addNotification(null, E('p', _('Please specify the command to send')), 'info');
return false;
}

const modemIdx = await getModemIndex();
if (!modemIdx) {
ui.addNotification(null, E('p', _('Please configure the modem')), 'info');
return false;
}

// Send AT command using mmcli: mmcli -m 0 --command="AT+CSQ"
return this.handleCommand('mmcli', [ '-m', modemIdx, '--command=' + atcmd ]);
},

handleClear: function(ev) {
const out = document.querySelector('.atcommand-output');
out.style.display = 'none';

const ov = document.getElementById('cmdvalue');
ov.value = '';

document.getElementById('cmdvalue').focus();
},

handleCopy: function(ev) {
const out = document.querySelector('.atcommand-output');
out.style.display = 'none';

const ov = document.getElementById('cmdvalue');
ov.value = '';
const x = document.getElementById('tk').value;
ov.value = x;
},

load: function() {
return Promise.all([
L.resolveDefault(fs.read_direct('/etc/modem/atcmmds.user'), null),
uci.load('sms_tool_js').then(function() {
if (!uci.get('sms_tool_js', '@sms_tool_js[0]')) {
uci.add('sms_tool_js', 'sms_tool_js');
uci.set('sms_tool_js', '@sms_tool_js[0]', 'modem_index', '0');
}
})
]);
},

render: function (loadResults) {

const info = _('User interface for sending AT commands using ModemManager mmcli. More information about ModemManager on the %sModemManager documentation%s.').format('<a href="https://www.freedesktop.org/wiki/Software/ModemManager/" target="_blank">', '</a>');

return E('div', { 'class': 'cbi-map', 'id': 'map' }, [
E('h2', {}, [ _('AT Commands') ]),
E('div', { 'class': 'cbi-map-descr'}, info),
E('hr'),
E('div', { 'class': 'cbi-section' }, [
E('div', { 'class': 'cbi-section-node' }, [
E('div', { 'class': 'cbi-value' }, [
E('label', { 'class': 'cbi-value-title' }, [ _('User AT commands') ]),
E('div', { 'class': 'cbi-value-field' }, [
E('select', { 'class': 'cbi-input-select',
'id': 'tk',
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
E('label', { 'class': 'cbi-value-title' }, [ _('Command to send') ]),
E('div', { 'class': 'cbi-value-field' }, [
E('input', {
'style': 'margin:5px 0; width:100%;',
'type': 'text',
'id': 'cmdvalue',
'data-tooltip': _('Press [Enter] to send the command, press [Delete] to delete the command'),
'keydown': function(ev) {
if (ev.keyCode === 13) {
const execBtn = document.getElementById('execute');
if (execBtn) {
execBtn.click();
}
}
if (ev.keyCode === 46) {
const ov = document.getElementById('cmdvalue');
ov.value = '';
document.getElementById('cmdvalue').focus();
}
}
}),
])
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
E('button', {
'class': 'cbi-button cbi-button-action important',
'id': 'execute',
'click': ui.createHandlerFn(this, 'handleGo')
}, [ _('Send command') ]),
]),
E('p', _('Reply')),
E('pre', { 'class': 'atcommand-output', 'style': 'display:none; border: 1px solid var(--border-color-medium); border-radius: 5px; font-family: monospace' }),

]);
},

handleSaveApply: null,
handleSave: null,
handleReset: null
})
