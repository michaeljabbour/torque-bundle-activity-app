function el(type, props = {}, children = null) {
  return { type, props, children };
}

export const Stack = (props, children) => el('stack', props, children);
export const Grid = (props, children) => el('grid', props, children);
export const Text = (props) => el('text', props);
export const TextField = (props) => el('text-field', props);
export const Button = (props) => el('button', props);
export const Alert = (props) => el('alert', props);
export const Card = (props, children) => el('card', props, children);
export const Badge = (props) => el('badge', props);
export const Divider = (props) => el('divider', props || {});
export const Spinner = (props) => el('spinner', props || {});
export const Form = (props, children) => el('form', props, children);
export const Icon = (props) => el('icon', props);
export const Checkbox = (props) => el('checkbox', props);
export const FilterDropdown = (props) => el('filter-dropdown', props);
