import { Component } from '@angular/core';
import { IonButtons, IonMenuButton } from '@ionic/angular';

/** Botão do menu lateral para a barra de topo dos ecrãs principais: `<app-nav-button slot="start" />`. */
@Component({
  selector: 'app-nav-button',
  imports: [IonButtons, IonMenuButton],
  template: `<ion-buttons><ion-menu-button menu="main-menu" autoHide="true" /></ion-buttons>`,
})
export class NavButtonComponent {}
