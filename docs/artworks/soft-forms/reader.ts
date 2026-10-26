/// <reference types="vite/client" />
import source from './architecture.md?raw';
import furImage from '../../assets/fur-shells-and-ribbons.svg?url';
import { mountDocument } from '../../reader/reader';
import { createRibbonDemo, createShellDemo } from './demos';
import { createTouchDemo } from './touch-demo';
import { createBodyDemo } from './body-demo';
import { createCoatDemo } from './coat-demo';
import { createBindingDemo } from './binding-demo';
import './style.css';

mountDocument(source, {
  sourcePath: '/docs/artworks/soft-forms/architecture.md',
  images: { '/docs/assets/fur-shells-and-ribbons.svg': furImage },
  demos: { shells: createShellDemo, ribbons: createRibbonDemo, touch: createTouchDemo, body: createBodyDemo, coat: createCoatDemo, binding: createBindingDemo },
});
