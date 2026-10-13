#!/usr/bin/env node

import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const write = process.argv.includes('--write');
const plans = {
  alert: {method: 'close', args: [], event: 'sf-alert-close'},
  breadcrumbs: {method: 'getDisplayItems', args: []},
  buttons: {method: 'setDisabled', args: [true]},
  checkbox: {method: 'setChecked', args: [false]},
  datepicker: {method: 'openPanel', args: []},
  drawer: {method: 'toggle', args: []},
  dropdown: {method: 'toggleDropdown', args: []},
  'file-upload': {method: 'clear', args: []},
  gallery: {method: 'next', args: []},
  'icon-buttons': {method: 'setDisabled', args: [true]},
  inputs: {method: 'getInputElement', args: []},
  modal: {method: 'toggle', args: []},
  pagination: {method: 'goToPage', args: [3], event: 'sf-page-change'},
  'progress-bar': {method: 'setProgress', args: [80]},
  'progress-scale': {method: 'setProgress', args: [80]},
  radio: {method: 'setChecked', args: [false]},
  slider: {method: 'refresh', args: []},
  spinner: {method: 'refreshSpinner', args: []},
  steps: {method: 'goToStep', args: [2], event: 'sf-step-change'},
  switch: {method: 'setChecked', args: [false]},
  tabs: {method: 'goTo', args: [1], event: 'sf-tab-change'},
  toast: {method: 'close', args: []},
  toggle: {method: 'setChecked', args: [false]},
  'tree-item': {method: 'toggle', args: [], event: 'sf-tree-item-toggle'},
};

const changed = [];
for (const [component, plan] of Object.entries(plans)) {
  const file = path.resolve(root, 'src/smart', component, 'studio.scenario.json');
  const scenario = JSON.parse(await readFile(file, 'utf8'));
  scenario.actions = [{type: 'invoke', method: plan.method, arguments: plan.args}];
  scenario.assertions = [
    {type: 'upgraded'},
    ...(plan.event ? [{type: 'event', name: plan.event}] : []),
    {type: 'no-console-error'},
    {type: 'no-network'},
  ];
  changed.push(path.relative(root, file));
  if (write) await writeFile(file, `${JSON.stringify(scenario, null, 2)}\n`);
}

process.stdout.write(`${write ? 'WROTE' : 'WOULD_WRITE'} ${changed.length} primary interaction scenarios\n`);
for (const file of changed) process.stdout.write(`${file}\n`);
