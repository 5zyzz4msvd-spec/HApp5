import {contentPolicyFieldApplicable} from '../safety/character-content-policy-client.mjs';
import { evaluateCondition } from "./conditions.mjs";
import { pointerRead } from "./structure-schema.mjs";
import {CASH_POLICY_ID,CASH_DATE_ID} from './character-cash.mjs';

export function exposedElementValues(object, context = {}) {
  const fields = [];
  function visit(elements, labels = []) {
    for (const field of elements) {
      if(object.kind==='character'&&[CASH_POLICY_ID,CASH_DATE_ID].includes(field.id))continue;
      if (object.kind === "character" && (context.personnelPolicy?.retiredGroups?.includes(field.label) && field.type === "group" || context.personnelPolicy?.retiredFields?.includes(field.label))) continue;
      if(object.kind==="character"&&!contentPolicyFieldApplicable(object,field.label,field.id))continue;
      if (!field.enabled || !evaluateCondition(field.when, { ...context, owner: object, values: object.values })) continue;
      if (field.type === "group") { visit(field.elements, [...labels, field.label]); continue; }
      if (field.audience === "local") continue;
      const value = field.binding ? pointerRead(object, field.binding.path) : object.values[field.id];
      if (value === undefined) continue;
      fields.push({ id: field.id, label: [...labels, field.label].join(" / "), value, type: field.type, audience: field.audience, writable: !field.binding && field.modelWritable !== false });
    }
  }
  visit(object.elements ?? []);
  return fields;
}
