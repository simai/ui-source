// C116 and BA-1 (owner decision C295): the danger rule of the group actions
// is one, sf-bulk-actions' (an action that deletes says so with status
// "danger" or the danger flag -- "delete:Delete::danger", {danger: true} -- or
// by a value that deletes: delete, remove, destroy, trash). sf-pagination
// re-exports it for the hosts that imported it from here.
export {isDestructiveAction, orderActions} from "../../bulk-actions/js/danger.js";
