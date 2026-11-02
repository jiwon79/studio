if (new URLSearchParams(location.search).has('compare')) {
  void import('./comparison');
} else {
  void import('./script');
}
