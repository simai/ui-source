import { ComponentObserver } from '../../../core/js/ComponentObserver';
import registerComponent from '../../register-helper';

class TreeItem extends ComponentObserver {
  static componentName = 'TreeItem';
  html = null;
}

registerComponent('TreeItem', TreeItem);
