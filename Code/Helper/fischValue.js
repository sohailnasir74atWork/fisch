// The NPC sale rules are shared with the data pipeline and tested independently.
import rules from './fishRules';
export const mutationTable = rules.mutationTable;
export const selectModifier = rules.selectModifier;
export const fishValue = rules.fishValue;
export const weightRange = rules.weightRange;
export const sizeLabel = rules.sizeLabel;
export const formatFishValue = rules.formatFishValue;
export default rules;
