document.addEventListener('DOMContentLoaded', () => {
    let cart = JSON.parse(localStorage.getItem('shoppingCart')) || [];
    let shippingCost = 0;
    let currentProductInfo = {};
    const orderCounters = { polera: 1, taza: 1, gorro: 1 };

    const productModal = new bootstrap.Modal(document.getElementById('productModal'));
    const confirmationModal = new bootstrap.Modal(document.getElementById('confirmationModal'));

    const productSection = document.getElementById('productos');
    const cartList = document.getElementById('lista-carrito');
    const emptyCartBtn = document.getElementById('vaciar-carrito');
    const confirmAddToCartBtn = document.getElementById('confirm-add-to-cart');
    const modalOptionsPlaceholder = document.getElementById('modal-options-placeholder');
    const modalTitle = document.getElementById('productModalLabel');
    const checkoutSection = document.getElementById('checkout');
    const deliveryOptionRadios = document.querySelectorAll('.delivery-option');
    const customerForm = document.getElementById('checkout-form');
    const finalizeOrderBtn = document.getElementById('finalize-order-btn');
    const termsCheckbox = document.getElementById('terms-checkbox');
    const userContainer = document.getElementById('user-container');
    const paymentMethodRadios = document.querySelectorAll('input[name="paymentMethod"]');
    const webpayAmountInput = document.getElementById('webpay-monto');

    const paymentContainers = {
        webpay: document.getElementById('webpay-container'),
        transferencia: document.getElementById('transferencia-container'),
        efectivo: document.getElementById('efectivo-container')
    };
    
    const formInputs = {
        nombre: document.getElementById('nombre'),
        rut: document.getElementById('rut'),
        email: document.getElementById('email'),
        telefono: document.getElementById('telefono'),
        direccion: document.getElementById('direccion'),
        dob: document.getElementById('dob')
    };

    const activeUser = JSON.parse(localStorage.getItem('activeUser'));
    if (activeUser) {
        userContainer.innerHTML = `<div class="user-container d-flex align-items-center"><span class="navbar-text">Hola, ${activeUser.name.split(' ')[0]}!</span><a href="cuenta.html" class="nav-link ms-2">Mi Cuenta</a><button class="btn btn-outline-danger btn-sm ms-2" id="logout-btn">Salir</button></div>`;
        if (formInputs.nombre) formInputs.nombre.value = activeUser.name || '';
        if (formInputs.email) formInputs.email.value = activeUser.email || '';
        if (formInputs.rut) formInputs.rut.value = activeUser.rut || '';
        if (formInputs.telefono) formInputs.telefono.value = activeUser.telefono || '';
        if (formInputs.direccion) formInputs.direccion.value = activeUser.direccion || '';
        if (formInputs.dob) formInputs.dob.value = activeUser.dob || '';
        document.getElementById('logout-btn').addEventListener('click', () => {
            localStorage.removeItem('activeUser');
            sessionStorage.removeItem('isGuest');
            window.location.reload();
        });
    }

    termsCheckbox.addEventListener('change', () => { finalizeOrderBtn.disabled = !termsCheckbox.checked; });
    
    finalizeOrderBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!termsCheckbox.checked) {
            const toastLiveExample = document.getElementById('liveToast');
            const toastBody = document.getElementById('toast-body-message');
            toastBody.textContent = 'Debes aceptar los Términos y Condiciones.';
            const toast = new bootstrap.Toast(toastLiveExample);
            toast.show();
            return;
        }
        if (validateForm()) {
            finalizeOrderBtn.disabled = true;
            finalizeOrderBtn.textContent = 'Procesando...';

            const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + shippingCost;
            const entrega = document.querySelector('input[name="deliveryOption"]:checked + label').textContent;
            const pago = document.querySelector('input[name="paymentMethod"]:checked + label').textContent;

            const pedidoData = {
                cliente: {
                    nombre: formInputs.nombre.value, email: formInputs.email.value, rut: formInputs.rut.value,
                    telefono: formInputs.telefono.value, direccion: formInputs.direccion.value, dob: formInputs.dob.value,
                },
                carrito: cart, total: total, entrega: entrega, pago: pago
            };

            try {
                const response = await fetch('http://localhost:3000/api/crear-pedido', {
                    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(pedidoData),
                });
                if (!response.ok) throw new Error('Error del servidor.');
                
                const result = await response.json();
                if (result.success) {
                    generateOrderSummary(result.numeroPedido);
                    confirmationModal.show();
                    cart = [];
                    renderCart();
                } else {
                    alert('Hubo un error al procesar tu pedido.');
                }
            } catch (error) {
                alert('No se pudo conectar con el servidor. Revisa que el backend esté funcionando.');
            } finally {
                finalizeOrderBtn.disabled = false;
                finalizeOrderBtn.textContent = 'Finalizar Pedido';
            }
        }
    });

    // ... (El resto de los listeners y funciones se mantienen exactamente igual) ...
    productSection.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-to-cart-btn')) {
            const productCard = e.target.closest('.card');
            const name = productCard.querySelector('.card-title').textContent;
            const priceText = productCard.querySelector('.h4').textContent;
            const price = parseFloat(priceText.replace('$', '').replace('.', ''));
            currentProductInfo = { name: name, price: price, type: productCard.dataset.productType };
            setupModalForProduct(currentProductInfo);
            productModal.show();
        }
        if (e.target.classList.contains('add-to-cart-simple-btn')) {
            const button = e.target;
            const cartItem = { id: button.dataset.id, name: button.dataset.name, price: parseFloat(button.dataset.price), quantity: 1, color: 'Estándar', size: 'N/A', image: 'Diseño propio' };
            cart.push(cartItem);
            renderCart();
            const toastLiveExample = document.getElementById('liveToast');
            const toastBody = document.getElementById('toast-body-message');
            toastBody.textContent = `"${cartItem.name}" ha sido añadido al carrito.`;
            const toast = new bootstrap.Toast(toastLiveExample);
            toast.show();
        }
    });
    confirmAddToCartBtn.addEventListener('click', () => {
        const quantity = parseInt(document.getElementById('quantity-input').value);
        if (quantity < 1) return;
        const cartItem = { ...currentProductInfo, id: generateOrderId(currentProductInfo.type), quantity: quantity };
        const colorSelect = document.getElementById('color-select');
        const sizeSelect = document.getElementById('size-select');
        const imageInput = document.getElementById('image-upload');
        cartItem.color = colorSelect ? colorSelect.value : 'N/A';
        cartItem.size = sizeSelect ? sizeSelect.value : 'N/A';
        cartItem.image = imageInput && imageInput.files.length > 0 ? imageInput.files[0].name : 'Sin imagen';
        cart.push(cartItem);
        renderCart();
        productModal.hide();
    });
    emptyCartBtn.addEventListener('click', () => { cart = []; document.getElementById('retiro').checked = true; shippingCost = 0; if(formInputs.direccion) formInputs.direccion.required = false; renderCart(); });
    cartList.addEventListener('click', (e) => { if (e.target.classList.contains('delete-item-btn')) { cart = cart.filter(item => item.id !== e.target.dataset.id); renderCart(); } });
    deliveryOptionRadios.forEach(radio => { radio.addEventListener('change', (e) => { shippingCost = parseFloat(e.target.value); if(formInputs.direccion) formInputs.direccion.required = e.target.dataset.addressRequired === 'true'; renderCart(); }); });
    paymentMethodRadios.forEach(radio => { radio.addEventListener('change', (e) => { Object.values(paymentContainers).forEach(container => container.style.display = 'none'); if (paymentContainers[e.target.value]) { paymentContainers[e.target.value].style.display = 'block'; } }); });
    Object.values(formInputs).forEach(input => { if(input) { input.addEventListener('input', () => { if (input.classList.contains('is-invalid')) { input.classList.remove('is-invalid'); } }); } });

    const showError = (input, message) => { const errorDiv = document.getElementById(`${input.id}-error`); input.classList.add('is-invalid'); if (errorDiv) errorDiv.textContent = message; };
    const clearError = (input) => { const errorDiv = document.getElementById(`${input.id}-error`); input.classList.remove('is-invalid'); if (errorDiv) errorDiv.textContent = ''; };
    const validateRut = (rut) => { if (!/^[0-9]{7,8}-[\dkK]{1}$/.test(rut)) return false; let [cuerpo, dv] = rut.split('-'); let suma = 0; let multiplo = 2; for (let i = cuerpo.length - 1; i >= 0; i--) { suma += parseInt(cuerpo.charAt(i)) * multiplo; multiplo = multiplo === 7 ? 2 : multiplo + 1; } const dvEsperado = 11 - (suma % 11); const dvFinal = (dvEsperado === 11) ? '0' : (dvEsperado === 10) ? 'K' : dvEsperado.toString(); return dv.toLowerCase() === dvFinal.toLowerCase(); };
    const validateAge = () => {
        const dobString = formInputs.dob.value;
        if (!dobString) { showError(formInputs.dob, 'Debes ingresar tu fecha de nacimiento.'); return false; }
        const today = new Date();
        const birthDate = new Date(dobString);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) { age--; }
        if (age < 18) { showError(formInputs.dob, 'Debes ser mayor de 18 años para comprar.'); return false; }
        return true;
    };
    const validateForm = () => {
        let isValid = true;
        Object.values(formInputs).forEach(clearError);
        if (formInputs.nombre.value.trim() === '') { showError(formInputs.nombre, 'Ingresa tu nombre.'); isValid = false; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formInputs.email.value)) { showError(formInputs.email, 'Ingresa un correo válido.'); isValid = false; }
        if (!validateRut(formInputs.rut.value)) { showError(formInputs.rut, 'El RUT no es válido.'); isValid = false; }
        if (!/^[0-9]{9}$/.test(formInputs.telefono.value)) { showError(formInputs.telefono, 'El teléfono debe tener 9 dígitos.'); isValid = false; }
        if (formInputs.direccion.required && formInputs.direccion.value.trim() === '') { showError(formInputs.direccion, 'La dirección es obligatoria.'); isValid = false; }
        if (!validateAge()) { isValid = false; }
        return isValid;
    };
    function generateOrderId(type) { const prefix = type ? type.charAt(0).toUpperCase() : 'P'; const number = (orderCounters[type] || 0) + 1; orderCounters[type] = number; return `${prefix}${String(number).padStart(3, '0')}`; }
    function setupModalForProduct(product) { modalTitle.textContent = `Personaliza tu ${product.name}`; let optionsHTML = `<div class="mb-3"><label for="color-select" class="form-label">Color:</label><select class="form-select" id="color-select"><option>Negro</option><option>Blanco</option></select></div>`; if (product.type === 'polera') { optionsHTML += `<div class="mb-3"><label for="size-select" class="form-label">Talla:</label><select class="form-select" id="size-select"><option>S</option><option>M</option><option>L</option><option>XL</option></select></div>`; } optionsHTML += `<div class="mb-3"><label for="image-upload" class="form-label">Adjunta tu imagen:</label><input class="form-control" type="file" id="image-upload" accept="image/*"></div>`; optionsHTML += `<div class="mb-3"><label for="quantity-input" class="form-label">Cantidad:</label><input type="number" class="form-control" id="quantity-input" value="1" min="1"></div>`; modalOptionsPlaceholder.innerHTML = optionsHTML; }
    function renderCart() { cartList.innerHTML = ''; const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0); const total = subtotal + shippingCost; if (cart.length === 0) { cartList.innerHTML = '<p class="text-center text-muted">Tu carrito está vacío.</p>'; checkoutSection.style.display = 'none'; } else { checkoutSection.style.display = 'block'; cart.forEach(item => { const itemHTML = `<div class="card mb-2"><div class="card-body"><div class="d-flex justify-content-between align-items-center"><div><h6 class="mb-0">${item.name} (${item.id})</h6><small class="text-muted">Cantidad: ${item.quantity} | Color: ${item.color}</small></div><div class="d-flex align-items-center"><span class="fw-bold me-3">${formatPrice(item.price * item.quantity)}</span><button class="btn btn-sm btn-outline-danger delete-item-btn" data-id="${item.id}">X</button></div></div></div></div>`; cartList.innerHTML += itemHTML; }); } document.getElementById('subtotal-carrito').textContent = formatPrice(subtotal); document.getElementById('envio-carrito').textContent = formatPrice(shippingCost); document.getElementById('total-carrito').textContent = formatPrice(total); if (webpayAmountInput) { webpayAmountInput.value = Math.round(total); } localStorage.setItem('shoppingCart', JSON.stringify(cart)); }
    function generateOrderSummary(numeroPedido) {
        const customerName = formInputs.nombre.value;
        const total = document.getElementById('total-carrito').textContent;
        let summaryHTML = `<h5>¡Gracias, ${customerName.split(' ')[0]}!</h5><p>Tu pedido <strong>N° ${numeroPedido}</strong> ha sido registrado.</p><h6>Resumen:</h6><ul>${cart.map(item => `<li>${item.quantity} x ${item.name}</li>`).join('')}</ul><p><strong>Total:</strong> <span class="fw-bold">${total}</span></p>`;
        document.getElementById('order-summary').innerHTML = summaryHTML;
    }
    function formatPrice(price) { return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(price); }
    
    renderCart();
});