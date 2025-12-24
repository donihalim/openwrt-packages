'use strict';
'require form';
'require fs';
'require view';
'require uci';
'require ui';

/*
Copyright 2022-2025 Rafał Wabik - IceG - From eko.one.pl forum
Refactored for ModemManager/mmcli - December 2025

Licensed to the GNU General Public License v3.0.
*/

return view.extend({
load: function() {
return Promise.all([
fs.exec('/usr/bin/mmcli', ['-L']).catch(() => ({ stdout: '', stderr: '' })),
uci.load('sms_tool_js')
]);
},

render: function(loadResults) {
let m, s, o;
const modemListResult = loadResults[0];

m = new form.Map('sms_tool_js', _('Configuration ModemManager'), _('Configuration panel for ModemManager mmcli and GUI application.'));

s = m.section(form.TypedSection, 'sms_tool_js', '', null);
s.anonymous = true;

//TAB SMS

s.tab('smstab', _('SMS Settings'));
s.anonymous = true;

o = s.taboption('smstab', form.ListValue, 'modem_index', _('Modem'),
_('Select the modem to use. Run "mmcli -L" in terminal to list available modems.'));

// Parse modem list from mmcli -L output
if (modemListResult && modemListResult.stdout) {
const lines = modemListResult.stdout.split('\n');
let foundModems = false;

for (const line of lines) {
const match = line.match(/\/Modem\/(\d+)/);
if (match) {
const modemIdx = match[1];
// Extract modem description if available
const descMatch = line.match(/\]\s+(.+)$/);
const desc = descMatch ? descMatch[1] : 'Modem ' + modemIdx;
o.value(modemIdx, desc);
foundModems = true;
}
}

if (!foundModems) {
o.value('0', _('No modems detected - Manual entry'));
}
} else {
o.value('0', _('Modem 0 (default)'));
}

o.default = '0';
o.rmempty = false;

o = s.taboption('smstab', form.Button, '_fsave');
o.title = _('Save messages to a text file');
o.description = _('This option allows to backup SMS messages.');
o.inputtitle = _('Save as .txt file');
o.onclick = function() {
return uci.load('sms_tool_js').then(function() {
const modemIdx = uci.get('sms_tool_js', '@sms_tool_js[0]', 'modem_index') || '0';

L.resolveDefault(fs.exec('/usr/bin/mmcli', ['-m', modemIdx, '--messaging-list-sms']))
.then(function(listRes) {
if (listRes && listRes.stdout) {
const lines = listRes.stdout.trim().split('\n');
const smsPaths = [];

for (const line of lines) {
const match = line.match(/\/SMS\/\d+/);
if (match) {
smsPaths.push(match[0]);
}
}

// Fetch all SMS and compile into text
const promises = smsPaths.map(path => 
fs.exec('/usr/bin/mmcli', ['-m', modemIdx, '--sms=' + path, '-K'])
);

Promise.all(promises).then(function(results) {
let smsText = '';

for (const res of results) {
if (res && res.stdout) {
const lines = res.stdout.split('\n');
let number = '', text = '', timestamp = '';

for (const line of lines) {
if (line.includes('sms.content.number')) {
number = line.split(':')[1].trim();
} else if (line.includes('sms.content.text')) {
text = line.split(':')[1].trim();
} else if (line.includes('sms.properties.timestamp')) {
timestamp = line.split(':')[1].trim();
}
}

if (number && text) {
smsText += 'From: ' + number + '\n';
smsText += 'Date: ' + timestamp + '\n';
smsText += 'Message: ' + text + '\n';
smsText += '---\n\n';
}
}
}

if (smsText.length > 0) {
if (confirm(_('Save SMS to txt file?'))) {
L.ui.showModal(_('Saving...'), [
E('p', { 'class': 'spinning' }, _('Please wait.. Process of saving SMS message to a text file is in progress.'))
]);

const link = E('a', {
'download': 'mysms.txt',
'href': URL.createObjectURL(
new Blob([smsText], { type: 'text/plain' })),
});

window.setTimeout(function() {
link.click();
URL.revokeObjectURL(link.href);
L.hideModal();
}, 1000);
}
} else {
ui.addNotification(null, E('p', {}, _('No SMS messages found.')));
}
});
}
});
});
};

o = s.taboption('smstab', form.Value, 'pnumber', _('Prefix number'),
_("The phone number should be preceded by the country prefix (for Poland it is 48, without '+'). If the number is 5, 4 or 3 characters, it is treated as 'short' and should not be preceded by a country prefix."));
o.default = '48';
o.validate = function(section_id, value) {
if (value.match(/^[0-9]+(?:\.[0-9]+)?$/))
return true;
return _('Expect a decimal value');
};

o = s.taboption('smstab', form.Flag, 'prefix', _('Add prefix to phone number'),
_('Automatically add prefix to the phone number field.'));
o.rmempty = false;

o = s.taboption('smstab', form.Flag, 'sendingroup', _('Enable group messaging'),
_("This option allows you to send one message to all contacts in the user's contact list."));
o.rmempty = false;
o.default = false;

o = s.taboption('smstab', form.Value, 'delay', _('Message sending delay'),
_("[3 - 59] second(s) - Messages are sent without verification. There is a risk of non-delivery."));
o.default = "3";
o.rmempty = false;
o.validate = function(section_id, value) {
if (value.match(/^[0-9]+(?:\.[0-9]+)?$/) && +value >= 3 && +value < 60)
return true;
return _('Expect a decimal value between three and fifty-nine');
};
o.depends("sendingroup", "1");
o.datatype = 'range(3, 59)';

o = s.taboption('smstab', form.Flag, 'information', _('Explanation of number and prefix'),
_('In the tab for sending SMSes, show an explanation of the prefix and the correct phone number.'));
o.rmempty = false;

o = s.taboption('smstab', form.TextValue, '_tmp2', _('User contacts'),
_("Each line must have the following format: 'Contact name;phone number'. For user convenience, the file is saved to the location <code>/etc/modem/phonebook.user</code>."));
o.rows = 7;
o.cfgvalue = function(section_id) {
return fs.trimmed('/etc/modem/phonebook.user');
};
o.write = function(section_id, formvalue) {
return fs.write('/etc/modem/phonebook.user', formvalue.trim().replace(/\r\n/g, '\n') + '\n');
};

//TAB AT

s.tab('attab', _('AT Commands Settings'));
s.anonymous = true;

o = s.taboption('attab', form.TextValue, '_tmp6', _('User AT commands'),
_("Each line must have the following format: 'AT command description;AT command'. For user convenience, the file is saved to the location <code>/etc/modem/atcmmds.user</code>."));
o.rows = 20;
o.cfgvalue = function(section_id) {
return fs.trimmed('/etc/modem/atcmmds.user');
};
o.write = function(section_id, formvalue) {
return fs.write('/etc/modem/atcmmds.user', formvalue.trim().replace(/\r\n/g, '\n') + '\n');
};

return m.render();
}
});
